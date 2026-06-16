import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/admin/mutations";
import { LogOut } from "lucide-react";
import { useState } from "react";

const links = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/draws", label: "Sorteos" },
  { to: "/admin/games", label: "Juegos" },
  { to: "/admin/settings", label: "Configuración" },
  { to: "/admin/audit", label: "Auditoría" },
];

export function AdminNav() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      navigate("/admin/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <nav className="mb-10 flex flex-wrap items-center gap-1 border-b pb-5">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            cn(
              "rounded-md px-4 py-2.5 text-sm transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={handleLogout}
          disabled={loading}
        >
          <LogOut className="size-4" />
          {loading ? "Saliendo…" : "Cerrar sesión"}
        </Button>
      </div>
    </nav>
  );
}
