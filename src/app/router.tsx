import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { SiteHeader } from "@/components/public/site-header";
import { AdminGuard, PublicLayout } from "@/app/layouts";
import { Spinner } from "@/components/ui/feedback";
import { HomePage } from "@/app/routes/home";

const GameDetailPage = lazy(() =>
  import("@/app/routes/game-detail").then((m) => ({ default: m.GameDetailPage })),
);
const AdminLoginPage = lazy(() =>
  import("@/app/routes/admin/login").then((m) => ({ default: m.AdminLoginPage })),
);
const AdminDashboardPage = lazy(() =>
  import("@/app/routes/admin/dashboard").then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminGameDetailPage = lazy(() =>
  import("@/app/routes/admin/game-detail").then((m) => ({
    default: m.AdminGameDetailPage,
  })),
);
const AdminDrawsPage = lazy(() =>
  import("@/app/routes/admin/draws").then((m) => ({ default: m.AdminDrawsPage })),
);
const AdminGamesPage = lazy(() =>
  import("@/app/routes/admin/games").then((m) => ({ default: m.AdminGamesPage })),
);
const AdminSettingsPage = lazy(() =>
  import("@/app/routes/admin/settings").then((m) => ({ default: m.AdminSettingsPage })),
);
const AdminAuditPage = lazy(() =>
  import("@/app/routes/admin/audit").then((m) => ({ default: m.AdminAuditPage })),
);

function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}

const basename =
  import.meta.env.BASE_URL === "/"
    ? undefined
    : import.meta.env.BASE_URL.replace(/\/$/, "");

const routes = [
  {
    element: (
      <RootLayout>
        <PublicLayout />
      </RootLayout>
    ),
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "game/:id",
        element: (
          <Lazy>
            <GameDetailPage />
          </Lazy>
        ),
      },
    ],
  },
  {
    path: "admin/login",
    element: (
      <RootLayout>
        <Lazy>
          <AdminLoginPage />
        </Lazy>
      </RootLayout>
    ),
  },
  {
    path: "admin",
    element: (
      <RootLayout>
        <AdminGuard />
      </RootLayout>
    ),
    children: [
      {
        index: true,
        element: (
          <Lazy>
            <AdminDashboardPage />
          </Lazy>
        ),
      },
      {
        path: "players",
        element: <Navigate to="/admin/games" replace />,
      },
      {
        path: "games/:id",
        element: (
          <Lazy>
            <AdminGameDetailPage />
          </Lazy>
        ),
      },
      {
        path: "draws",
        element: (
          <Lazy>
            <AdminDrawsPage />
          </Lazy>
        ),
      },
      {
        path: "games",
        element: (
          <Lazy>
            <AdminGamesPage />
          </Lazy>
        ),
      },
      {
        path: "settings",
        element: (
          <Lazy>
            <AdminSettingsPage />
          </Lazy>
        ),
      },
      {
        path: "audit",
        element: (
          <Lazy>
            <AdminAuditPage />
          </Lazy>
        ),
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routes, { basename });
