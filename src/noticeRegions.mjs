export const noticeRegions=[
 ['서울',['서울']],['부산',['부산']],['대구',['대구']],['인천',['인천']],
 ['광주',['광주']],['대전',['대전']],['울산',['울산']],['세종',['세종']],
 ['경기',['경기']],['강원',['강원']],['충북',['충청북도','충북']],['충남',['충청남도','충남']],
 ['전북',['전북','전라북도']],['전남',['전남','전라남도']],['경북',['경상북도','경북']],
 ['경남',['경상남도','경남']],['제주',['제주']]
];
export function matchesNoticeRegion(region,selected){
 if(!selected)return true;
 const aliases=noticeRegions.find(([label])=>label===selected)?.[1];
 return !!aliases?.some(alias=>(region||'').includes(alias));
}
