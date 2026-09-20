import { LogIn, LogOut, UserRound } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "./ui/utils";
import { useAuth } from "../lib/auth";

interface AccountMenuProps {
  className?: string;
  prominent?: boolean;
}

/** Header control: "Log in" when signed out, username menu with Sign out when signed in. */
export function AccountMenu({ className, prominent = false }: AccountMenuProps) {
  const { status, profile, user, requireAuth, signOut } = useAuth();

  if (status === "unavailable" || status === "loading") return null;

  if (status === "signed_out") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => requireAuth()}
        className={cn("h-9 shrink-0 gap-1.5 px-2.5 sm:px-3", className)}
        aria-label="Log in or sign up"
      >
        <LogIn className="h-4 w-4" />
        <span className={prominent ? "inline" : "hidden sm:inline"}>
          {prominent ? "Log in or create account" : "Log in"}
        </span>
      </Button>
    );
  }

  const name = profile?.username ?? "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-9 max-w-[11rem] shrink-0 gap-1.5 px-2.5 sm:px-3", className)}
          aria-label={`Account menu for ${name}`}
        >
          <UserRound className="h-4 w-4" />
          <span className={cn("truncate", prominent ? "inline" : "hidden sm:inline")}>{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-semibold">{name}</span>
          {user?.email && (
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
