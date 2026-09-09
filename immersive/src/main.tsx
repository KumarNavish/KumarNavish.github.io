import { createRoot,hydrateRoot } from 'react-dom/client';
import { App } from './App';
import './base.css';
const root=document.getElementById('root')!;
const element=<App initialPath={location.pathname}/>;
if(root.querySelector('main'))hydrateRoot(root,element);else createRoot(root).render(element);
