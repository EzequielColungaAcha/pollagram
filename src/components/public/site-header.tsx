import { Link, NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

const publicLinks = [{ to: "/", label: "Inicio" }];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Polla
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {publicLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                cn(buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }))
              }
            >
              {link.label}
            </NavLink>
          ))}
          <Separator orientation="vertical" className="mx-0.5 h-5" />
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }))
            }
          >
            Admin
          </NavLink>
          <div className="ml-1">
            <ModeToggle />
          </div>
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <ModeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Menú">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>Menú</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {publicLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end
                    className={({ isActive }) =>
                      cn(
                        "rounded-md px-4 py-2.5 text-sm",
                        isActive ? "bg-muted" : "text-muted-foreground",
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
                <Link to="/admin" className="rounded-md px-4 py-2.5 text-sm">
                  Admin
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
