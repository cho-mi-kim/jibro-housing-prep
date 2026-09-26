import json
from pathlib import Path
import unittest
from export_income_guides import parse_page

class IncomeGuideTests(unittest.TestCase):
 def setUp(self):
  guides=json.loads(Path('src/incomeGuides.json').read_text(encoding='utf-8'))
  self.guide=next(g for k,g in guides.items() if 'panId=2015122300020810&' in k)
 def test_verified_source(self):
  parsed=parse_page(self.guide['quote'])
  self.assertEqual([r['monthlyWon'] for r in parsed['rows']],[3432027,4693016,5717900,6161541])
 def test_missing_row_is_not_inferred(self):
  self.assertIsNone(parse_page(self.guide['quote'].replace('6,161,541','missing')))
 def test_unsupported_columns_or_missing_allowance_are_not_guessed(self):
  self.assertIsNone(parse_page(self.guide['quote'].replace('70%','100%')))
  self.assertIsNone(parse_page(self.guide['quote'].replace('20% 가산','10% 가산')))

if __name__=='__main__':unittest.main()
