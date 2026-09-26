"""Publish verified public snapshots atomically; failed extraction retains last good data."""
import json, os, tempfile
from pathlib import Path

def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + '.', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as output:
            json.dump(value, output, ensure_ascii=False, indent=2)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)

def merge_success(previous, successful):
    return {**previous, **successful}

def save_attempt(path, kind, key, when, success):
    path = Path(path)
    data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'version': 1, 'attempts': {}}
    data['attempts'].setdefault(key, {})[kind] = {'attemptedAt': when, 'status': 'ok' if success else 'failed'}
    atomic_json(path, data)
