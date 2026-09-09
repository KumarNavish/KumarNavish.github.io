import { createContext,useContext,useEffect,useRef,useState,type ReactNode,type AnchorHTMLAttributes } from 'react';
import { exhibitByPath } from './data/exhibits';
const ALIASES:Record<string,string>={'/publications':'/research','/projects':'/work','/experience':'/about','/casepath':'/systems/casepath','/work/casepath':'/systems/casepath','/work/spatial-intelligence':'/frontier/spatial-intelligence','/research/spatial-intelligence':'/frontier/spatial-intelligence','/labs/spatial-intelligence':'/frontier/spatial-intelligence','/research/graph-laplacians':'/work/normalized-gain-laplacians','/work/gain-graphs':'/work/normalized-gain-laplacians','/research/gbr':'/work/experience-replay-optimization','/research/experience-replay-optimization':'/work/experience-replay-optimization','/research/rank-feasibility':'/work/rank-feasibility','/research/ticlm':'/work/ticlm-replay-value'};
export const cleanPath=(p:string)=>{const path=p.split('?')[0].replace(/\/+$/,'')||'/';return ALIASES[path]??path;};
export function metadata(path:string){const e=exhibitByPath(cleanPath(path));const title=e?`${e.name} — Navish Kumar`:path==='/trajectory'?'Research trajectory — Navish Kumar':path==='/work'?'All work — Navish Kumar':path==='/research'?'Research record — Navish Kumar':path==='/systems'?'Systems — Navish Kumar':path==='/about'?'About — Navish Kumar':'Navish Kumar — Machine-learning researcher & systems builder';return {title,description:e?e.question:'Explore research in optimization, continual learning, evidence-grounded systems, and persistent spatial interfaces through live 3D explanations.'};}
type Navigation={path:string;go:(path:string)=>void};
const Context=createContext<Navigation>({path:'/',go:()=>{}});
export const useNavigation=()=>useContext(Context);
export function NavigationProvider({initialPath,children}:{initialPath:string;children:ReactNode}){
 const [path,setPath]=useState(cleanPath(initialPath)),scroll=useRef(0);
 useEffect(()=>{const handler=(e:PopStateEvent)=>{scroll.current=e.state?.scrollY??0;setPath(cleanPath(location.pathname));};window.addEventListener('popstate',handler);history.scrollRestoration='manual';return ()=>window.removeEventListener('popstate',handler);},[]);
 useEffect(()=>{document.title=metadata(path).title;const canonical=document.querySelector('link[rel="canonical"]');canonical?.setAttribute('href',`https://navishk.netlify.app${path==='/'?'/':path+'/'}`);requestAnimationFrame(()=>window.scrollTo(0,scroll.current));},[path]);
 const go=(url:string)=>{history.replaceState({...history.state,scrollY:window.scrollY},'',location.href);history.pushState({scrollY:0},'',url);scroll.current=0;setPath(cleanPath(url));};
 return <Context.Provider value={{path,go}}>{children}</Context.Provider>;
}
export function Link({href,children,onClick,...rest}:AnchorHTMLAttributes<HTMLAnchorElement>&{href:string}){
 const {go}=useNavigation();
 return <a href={href} {...rest} onClick={e=>{onClick?.(e);if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||rest.target||!href.startsWith('/')||href.startsWith('//'))return;e.preventDefault();go(href);}}>{children}</a>;
}
export { ALIASES };
