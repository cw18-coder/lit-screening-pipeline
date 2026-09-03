import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';

const Home = lazy(() => import('./routes/Home').then(m => ({ default: m.Home })));
const Prisma = lazy(() => import('./routes/Prisma').then(m => ({ default: m.Prisma })));
const PrismaNode = lazy(() => import('./routes/PrismaNode').then(m => ({ default: m.PrismaNode })));
const Wiki = lazy(() => import('./routes/Wiki').then(m => ({ default: m.Wiki })));
const WikiPage = lazy(() => import('./routes/WikiPage').then(m => ({ default: m.WikiPage })));
const Search = lazy(() => import('./routes/Search').then(m => ({ default: m.Search })));
const About = lazy(() => import('./routes/About').then(m => ({ default: m.About })));

const LoadingFallback = () => (
  <div className="route-view" style={{ padding: '24px 0', color: 'var(--ink-mute)' }}>
    Loading…
  </div>
);

export function App() {
  return (
    <>
      <Header />
      <main>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/prisma" element={<Prisma />} />
            <Route path="/prisma/:nodeId" element={<PrismaNode />} />
            <Route path="/wiki" element={<Wiki />} />
            <Route path="/wiki/:section/:pageId" element={<WikiPage />} />
            <Route path="/search" element={<Search />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<div className="route-view">Route not found.</div>} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}
