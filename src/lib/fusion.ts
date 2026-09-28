import type { WordEntry } from "../data/types";
const VOWELS="aeiouy";const isV=(c:string)=>VOWELS.includes(c);
const head=(w:string)=>{let i=0;while(i<w.length&&!isV(w[i]))i++;while(i<w.length&&isV(w[i]))i++;return Math.max(2,Math.min(i,w.length));};
const tail=(w:string)=>{let i=w.length-1;while(i>=0&&!isV(w[i]))i--;while(i>=0&&isV(w[i]))i--;return Math.max(1,i+1);};
const clean=(w:string)=>w.toLowerCase().replace(/[^a-z]/g,"").replace(/(.)\1{2,}/g,"$1$1").replace(/([aeiouy])\1+/g,"$1");
function overlap(a:string,b:string){for(let n=Math.min(4,a.length-1,b.length-1);n>=2;n--){if(a.slice(-n)===b.slice(0,n))return a+b.slice(n)}return a.slice(-1)===b[0]?a+b.slice(1):null}
function bridge(a:string,b:string){const av=[...a].reverse().find(isV),bv=[...b].find(isV);if(!av||!bv||av===bv)return null;return clean(a.slice(0,-1)+bv+b.slice(1));}
const SUFFIXES=["ly","io","ify","ora","ix","um","eo","ia","ra"];
export type FusionVariant={name:string;method:string};
export function fusePair(aRaw:string,bRaw:string):FusionVariant[]{const a=aRaw.toLowerCase().replace(/[^a-z]/g,"");const b=bRaw.toLowerCase().replace(/[^a-z]/g,"");if(!a||!b||a===b)return[];const ah=head(a),at=tail(a),bh=head(b),bt=tail(b);const v:FusionVariant[]=[{name:a.slice(0,ah)+b.slice(bt),method:"head+tail"},{name:b.slice(0,bh)+a.slice(at),method:"tail+head"},{name:a.slice(0,ah)+b.slice(0,bh),method:"clip+clip"},{name:a.slice(0,ah)+b,method:"head+word"},{name:a+b.slice(bt),method:"word+tail"},{name:a.slice(0,at)+b,method:"last-vowel+word"},{name:overlap(a,b)||"",method:"overlap"},{name:bridge(a,b)||"",method:"vowel-bridge"}];for(const suffix of SUFFIXES)v.push({name:a.slice(0,ah)+b.slice(bt)+suffix,method:"suffixed"});const seen=new Set<string>();return v.map(x=>({...x,name:clean(x.name)})).filter(x=>{if(x.name.length<4||x.name.length>16||x.name===a||x.name===b||seen.has(x.name))return false;seen.add(x.name);return[...x.name].some(isV)})}
export function scoreFusionCandidates(a:WordEntry,b:WordEntry,variants:FusionVariant[]){return variants}
