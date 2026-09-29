import unittest, tempfile, json
from pathlib import Path
from snapshot_store import atomic_json, merge_success, save_attempt
class SnapshotStoreTest(unittest.TestCase):
 def test_failed_notices_keep_old_and_new_success_replaces_only_its_key(self):
  old={'A':{'checkedAt':'old'},'B':{'checkedAt':'old'}}
  merged=merge_success(old,{'A':{'checkedAt':'new'}})
  self.assertEqual(merged['A']['checkedAt'],'new');self.assertEqual(merged['B']['checkedAt'],'old');self.assertEqual(old['A']['checkedAt'],'old')
 def test_atomic_round_trip_failure_state_and_recovery(self):
  with tempfile.TemporaryDirectory() as root:
   p=Path(root)/'attempts.json';save_attempt(p,'conditions','noticeA','one',False);save_attempt(p,'schedules','noticeB','two',True)
   d=json.loads(p.read_text(encoding='utf8'));self.assertEqual(d['attempts']['noticeA']['conditions']['status'],'failed')
   save_attempt(p,'conditions','noticeA','three',True);self.assertEqual(json.loads(p.read_text(encoding='utf8'))['attempts']['noticeA']['conditions']['status'],'ok');self.assertEqual(len(list(Path(root).glob('*.tmp'))),0)
 def test_corrupt_previous_attempts_are_not_silently_overwritten(self):
  with tempfile.TemporaryDirectory() as root:
   p=Path(root)/'attempts.json';p.write_text('corrupt')
   with self.assertRaises(json.JSONDecodeError):save_attempt(p,'conditions','A','now',True)
   self.assertEqual(p.read_text(),'corrupt')
if __name__=='__main__':unittest.main()
