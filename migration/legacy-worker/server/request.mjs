export const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff',...extra}});
import {HttpError} from './notebook.mjs';
export function writeGuard(request,origin=new URL(request.url).origin){
 if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site'||request.headers.get('x-jibro-request')!=='1')throw new HttpError(403,'origin','요청 출처를 확인할 수 없어요.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'content_type','JSON 요청이 필요해요.');
}
export async function body(request){
 if(Number(request.headers.get('content-length'))>250000)throw new HttpError(413,'size','저장할 기록이 너무 커요.');
 const reader=request.body?.getReader();let size=0,chunks=[];
 if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>250000){await reader.cancel();throw new HttpError(413,'size','저장할 기록이 너무 커요.');}chunks.push(value);}}
 try{const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}return JSON.parse(new TextDecoder().decode(bytes)||'{}');}catch{throw new HttpError(400,'json','요청 내용을 확인해주세요.');}
}
