import { useEffect,useState } from 'react';
import { Link,useNavigation } from '../navigation';
import { Icon } from './Icon';
const links=[['Trajectory','/trajectory'],['Work','/work'],['Research','/research'],['Systems','/systems'],['Spatial lab','/frontier/spatial-intelligence'],['About','/about']];
export function Header(){
 const [open,setOpen]=useState(false);const {path}=useNavigation();
 useEffect(()=>setOpen(false),[path]);
 return <header className="site-header">
  <a className="skip-link" href="#main">Skip to content</a>
  <Link href="/" className="brand" aria-label="Navish Kumar — home"><span className="brand-mark" aria-hidden="true">n.</span><span>Navish Kumar<small>Research & systems</small></span></Link>
  <button className="menu-button" aria-expanded={open} aria-controls="main-navigation" onClick={()=>setOpen(v=>!v)}><Icon name={open?'close':'menu'}/><span>{open?'Close':'Menu'}</span></button>
  <nav id="main-navigation" className={open?'main-nav is-open':'main-nav'} aria-label="Primary navigation">
   {links.map(([text,url])=><Link key={url} href={url} className={path===url?'active':''} aria-current={path===url?'page':undefined}>{text}</Link>)}
  </nav>
  <a href="mailto:navish.kumar@unibas.ch" className="header-contact">Get in touch<Icon name="arrow" size={16}/></a>
 </header>;
}
export function Footer(){return <footer className="site-footer">
 <div><Link href="/" className="footer-name">Navish Kumar</Link><p>Machine-learning research · Basel, Switzerland</p></div>
 <div className="footer-links"><a href="mailto:navish.kumar@unibas.ch">Email<Icon name="arrow" size={14}/></a><a href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en" target="_blank" rel="noreferrer">Scholar</a><a href="https://github.com/KumarNavish" target="_blank" rel="noreferrer">GitHub</a><a href="https://openreview.net/profile?id=~Navish_Kumar1" target="_blank" rel="noreferrer">OpenReview</a></div>
 </footer>;}
export function BackLink({href='/work',children='All work'}:{href?:string;children?:string}){return <Link className="back-link" href={href}><Icon name="back" size={15}/>{children}</Link>;}
