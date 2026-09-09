import { lazy, Suspense } from "react";
import { Header, Footer } from "./components/Shell";
import { HomePage } from "./HomePage";
import { NavigationProvider, useNavigation } from "./navigation";
import { exhibitByPath } from "./data/exhibits";
const WorkPage = lazy(() =>
  import("./Pages").then((m) => ({ default: m.WorkPage })),
);
const TrajectoryPage = lazy(() =>
  import("./Pages").then((m) => ({ default: m.TrajectoryPage })),
);
const ResearchPage = lazy(() =>
  import("./Pages").then((m) => ({ default: m.ResearchPage })),
);
const SystemsPage = lazy(() =>
  import("./Pages").then((m) => ({ default: m.SystemsPage })),
);
const FrontierPage = lazy(() =>
  import("./Pages").then((m) => ({ default: m.FrontierPage })),
);
const AboutPage = lazy(() =>
  import("./Pages").then((m) => ({ default: m.AboutPage })),
);
const ProjectPage = lazy(() =>
  import("./Pages").then((m) => ({ default: m.ProjectPage })),
);
const NotFoundPage = lazy(() =>
  import("./Pages").then((m) => ({ default: m.NotFoundPage })),
);
const SpatialLab = lazy(() =>
  import("./SpatialLab").then((m) => ({ default: m.SpatialLab })),
);
function Content() {
  const { path } = useNavigation();
  const exhibit = exhibitByPath(path);
  if (path === "/") return <HomePage />;
  if (path === "/frontier/spatial-intelligence") return <SpatialLab />;
  if (exhibit) return <ProjectPage key={exhibit.work.id} exhibit={exhibit} />;
  if (path === "/work") return <WorkPage />;
  if (path === "/trajectory") return <TrajectoryPage />;
  if (path === "/research") return <ResearchPage />;
  if (path === "/systems") return <SystemsPage />;
  if (path === "/frontier") return <FrontierPage />;
  if (path === "/about") return <AboutPage />;
  return <NotFoundPage />;
}
export function App({ initialPath = "/" }: { initialPath?: string }) {
  return (
    <NavigationProvider initialPath={initialPath}>
      <Header />
      <Suspense
        fallback={
          <main id="main" className="route-loading" aria-busy="true">
            Opening the research…
          </main>
        }
      >
        <Content />
      </Suspense>
      <Footer />
    </NavigationProvider>
  );
}
