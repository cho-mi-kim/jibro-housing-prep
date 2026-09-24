import unittest
from schedule_pdf import cell_dates, table_variants
from export_notice_schedules import parse_html


class ScheduleTests(unittest.TestCase):
    def test_explicit_intervals(self):
        self.assertEqual(cell_dates('‘26.9.29(화) ~ 10.1(목) [방문접수] (10:00~16:00)'), ('2026-09-29', '2026-10-01'))
        self.assertEqual(cell_dates('2026.10.13.(화)~14(수) 10:00∼16:00'), ('2026-10-13', '2026-10-14'))
        self.assertIsNone(cell_dates('9.29 ~ 10.1'))
        self.assertIsNone(cell_dates('2026.02.30'))
        self.assertIsNone(cell_dates('2026.09.29 또는 2026.10.1'))
        self.assertIsNone(cell_dates('2026.12.31 ~ 1.1'))

    def test_rank_scope_and_winner_are_not_document_selection(self):
        rows = [['대상주택 게시', '신청접수', '입주자\n선정결과 발표'], ['‘26.9.9', '‘26.9.29(화)~10.1(목)', '‘26.11.11(수)']]
        variants = table_variants(rows, '(1순위 우선) 수급자')
        self.assertEqual(variants[0]['label'], '공고문 · 1순위 우선 · 09.29~10.01')
        self.assertEqual(variants[0]['dates']['winnerAnnouncement'], '2026-11-11')
        self.assertNotIn('documentAnnouncement', variants[0]['dates'])
        self.assertEqual(table_variants(rows), [])

    def test_merged_unit_rows_keep_independent_dates(self):
        rows = [['신청순위', '단지명', '신청접수', '청약신청방법'], ['1,2,3순위', '다산2 [36형]', '2026.10.12', '현장'], [None, '다산2 [51형]', '2026.10.13.(화)~14(수)', None]]
        variants = table_variants(rows)
        self.assertEqual(len(variants), 2)
        self.assertEqual(variants[1]['dates']['applicationStart'], '2026-10-13')
        self.assertIn('현장', variants[1]['label'])
        rows[2][2] = '별도 안내'
        self.assertEqual(table_variants(rows), [])

    def test_detail_identity_and_null_fields(self):
        url = 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020746'
        raw = b"<script>var panId='2015122300020746';splScdlist.push({panId:'2015122300020746',sbscAcpStDt:'2026.10.12',sbscAcpClsgDt:'2026.10.14',pprSbmOpeAncDt:''})</script><section><h3>\xea\xb3\xb5\xea\xb8\x89\xec\x9d\xbc\xec\xa0\x95</h3></section>"
        variants, _ = parse_html(raw, url)
        self.assertEqual(variants[0]['dates'], {'applicationStart': '2026-10-12', 'deadline': '2026-10-14'})
        with self.assertRaises(ValueError):
            parse_html(raw, url.replace('20746', '29999'))


if __name__ == '__main__':
    unittest.main()
