"""Read explicit application-date cells; reject unresolved/ambiguous ranges."""
import datetime as dt
import re


def cell_dates(text):
    text = re.sub(r'\s+', '', text or '').replace('∼', '~').replace('～', '~')
    # Require a year in the same cell. Never borrow the current year or other rows.
    match = re.search(r"(?<!\d)(20\d{2}|[‘’']\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})", text)
    if not match:
        return None
    year = int(match[1]) if len(match[1]) == 4 else 2000 + int(match[1][1:])
    try:
        start = dt.date(year, int(match[2]), int(match[3]))
    except ValueError:
        return None
    rest = text[match.end():]
    # Strip the optional dot and Korean weekday before reading an adjacent range.
    rest = re.sub(r'^\.?(?:\([월화수목금토일]\))?', '', rest)
    end = start
    if rest.startswith('~'):
        endpoint = re.match(r"~(?:(20\d{2}|[‘’']\d{2})[.\-/])?(?:(\d{1,2})[.\-/])?(\d{1,2})(?!\d)", rest)
        if not endpoint:
            return None
        end_year = endpoint[1]
        end_year = (int(end_year) if len(end_year) == 4 else 2000 + int(end_year[1:])) if end_year else year
        try:
            end = dt.date(end_year, int(endpoint[2] or start.month), int(endpoint[3]))
        except ValueError:
            return None
        rest = rest[endpoint.end():]
    # Multiple disconnected dates cannot be reduced to one interval.
    if re.search(r"(?:20\d{2}|[‘’']\d{2})[.\-/]\d|\d{1,2}[.]\d{1,2}", rest) or end < start:
        return None
    return start.isoformat(), end.isoformat()


def table_variants(rows, context=''):
    if len(rows) < 2:
        return []
    headers = [re.sub(r'\s+', '', str(c or '')) for c in rows[0]]
    application = next((i for i, h in enumerate(headers) if h == '신청접수'), None)
    if application is None:
        return []
    labels = [i for i, h in enumerate(headers) if h in ['신청순위', '단지명', '주택형', '청약신청방법']]
    winner = next((i for i, h in enumerate(headers) if h in ['입주자선정결과발표', '예비입주자당첨발표']), None)
    # A rank heading directly above a table is also an explicit schedule scope.
    ranks = re.findall(r'\(([^()\n]*\d순위[^()\n]*)\)', context)
    scope = ranks[-1] if ranks else ''
    if not labels and not scope:
        return []
    out, previous = [], {}
    for row in rows[1:]:
        if len(row) != len(headers):
            return []
        if not row[application]:
            return []
        pair = cell_dates(row[application])
        if not pair:
            return []
        label_parts = []
        for i in labels:
            # PyMuPDF uses None only for merged cells, not empty textual cells.
            value = previous.get(i) if row[i] is None else row[i]
            previous[i] = value
            if value:
                label_parts.append(re.sub(r'\s+', ' ', value.split('※')[0]).strip())
        label = ' · '.join(label_parts) or scope
        if not label:
            return []
        dates = dict(applicationStart=pair[0], deadline=pair[1])
        if winner is not None:
            value = previous.get(winner) if row[winner] is None else row[winner]
            previous[winner] = value
            date = cell_dates(value)
            if date and date[0] == date[1]:
                dates['winnerAnnouncement'] = date[0]
        period = pair[0][5:].replace('-', '.') + ('~' + pair[1][5:].replace('-', '.') if pair[1] != pair[0] else '')
        out.append({'label': '공고문 · ' + label + ' · ' + period, 'dates': dates})
    return out


def attachment_variants(excerpts, pdf_dir, pymupdf):
    import hashlib
    out, seen_pages = [], set()
    for excerpt in excerpts:
        identity = (excerpt['sourceId'], excerpt['page'])
        if identity in seen_pages:
            continue
        seen_pages.add(identity)
        path = pdf_dir / (excerpt['sourceId'] + '.pdf')
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != excerpt['sha256']:
            continue
        with pymupdf.open(path) as doc:
            page = doc[excerpt['page'] - 1]
            for table in page.find_tables().tables:
                rect = pymupdf.Rect(table.bbox)
                left = page.rect.width / 2 if page.rect.width > page.rect.height * 1.25 and rect.x0 >= page.rect.width / 2 else 0
                context = page.get_text(clip=pymupdf.Rect(left, max(0, rect.y0 - 150), rect.x1, rect.y0), sort=True)
                for variant in table_variants(table.extract(), context):
                    variant['sourceId'] = excerpt['sourceId']
                    variant['page'] = excerpt['page']
                    if not any(v['label'] == variant['label'] and v['dates'] == variant['dates'] for v in out):
                        out.append(variant)
    return out
