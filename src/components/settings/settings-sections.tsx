"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LaptopMinimal, LogOut, Smartphone, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Label } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import { authErrorMessage, FormError, PasswordInput, PasswordStrength } from "@/components/auth/shared";
import { Avatar } from "@/components/layout/user-menu";
import { authClient } from "@/lib/auth-client";
import { formatDate, timeAgo } from "@/lib/utils";

export interface SettingsUser {
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  hasPassword: boolean;
  providers: string[];
}

export function ProfileSection({ user }: { user: SettingsUser }) {
  const router = useRouter();
  const [name, setName] = React.useState(user.name);
  const [pending, setPending] = React.useState(false);
  const changed = name.trim() !== user.name && name.trim().length > 0;
  return (
    <Card>
      <CardTitle extra={<UserRound className="ml-auto size-4 text-faint" />}>Profile</CardTitle>
      <div className="mt-4 flex items-center gap-3.5">
        <Avatar name={name || user.name} image={user.image} className="size-12 text-base" />
        <div className="min-w-0">
          <b className="block truncate">{user.name}</b>
          <span className="block truncate text-[13px] text-muted" suppressHydrationWarning>
            Member since {formatDate(user.createdAt)}
          </span>
        </div>
      </div>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!changed) return;
          setPending(true);
          const { error } = await authClient.updateUser({ name: name.trim() });
          setPending(false);
          if (error) return void toast.error(authErrorMessage(error));
          toast.success("Profile updated");
          router.refresh();
        }}
      >
        <Field label="Name" htmlFor="profile-name">
          <Input id="profile-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="profile-email" hint="Contact support to change the email on your account.">
          <Input id="profile-email" value={user.email} readOnly disabled />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" disabled={!changed} loading={pending}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function PasswordSection({ user }: { user: SettingsUser }) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [revoke, setRevoke] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!user.hasPassword) {
    return (
      <Card>
        <CardTitle extra={<KeyRound className="ml-auto size-4 text-faint" />}>Password</CardTitle>
        <p className="mt-3 text-[13px] text-muted">
          You sign in with {user.providers.filter((p) => p !== "credential").map((p) => p[0].toUpperCase() + p.slice(1)).join(" and ") || "a provider"}, so there is no
          password on this account.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle extra={<KeyRound className="ml-auto size-4 text-faint" />}>Password</CardTitle>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (next.length < 8) return setError("Use at least 8 characters for your new password.");
          setPending(true);
          setError(null);
          const { error: err } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: revoke });
          setPending(false);
          if (err) return setError(authErrorMessage(err));
          setCurrent("");
          setNext("");
          toast.success(revoke ? "Password changed. Other sessions were signed out." : "Password changed");
        }}
      >
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor="pw-current">Current password</Label>
          <PasswordInput id="pw-current" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor="pw-new">New password</Label>
          <PasswordInput id="pw-new" autoComplete="new-password" required minLength={8} maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} />
          <PasswordStrength password={next} />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-muted sm:col-span-2">
          <input type="checkbox" className="size-4 accent-blue" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} />
          Sign out of my other sessions
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" loading={pending} disabled={!current || !next}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

type SessionRow = { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; updatedAt: string | Date; createdAt: string | Date };

/** Hide the placeholder addresses local development produces (::, ::1, 127.x). */
function showIp(ip?: string | null): boolean {
  return !!ip && !/^[0:.]*$/.test(ip) && ip !== "::1" && !ip.startsWith("127.") && !/^(0+:){7}0*1$/.test(ip);
}

function deviceOf(ua?: string | null) {
  const s = ua || "";
  const mobile = /Mobile|Android|iPhone|iPad/i.test(s);
  const browser = /Edg\//.test(s) ? "Edge" : /Chrome\//.test(s) ? "Chrome" : /Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : "Browser";
  const os = /Windows/.test(s) ? "Windows" : /Mac OS X/.test(s) ? "macOS" : /Android/.test(s) ? "Android" : /iPhone|iPad/.test(s) ? "iOS" : /Linux/.test(s) ? "Linux" : "";
  return { mobile, label: [browser, os].filter(Boolean).join(" on ") };
}

export function SessionsSection() {
  const { data: current } = authClient.useSession();
  const [sessions, setSessions] = React.useState<SessionRow[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const { data, error } = await authClient.listSessions();
    if (error) {
      toast.error(authErrorMessage(error));
      setSessions([]);
      return;
    }
    setSessions((data as SessionRow[]).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
  }, []);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await authClient.listSessions();
      if (alive) setSessions(((data as SessionRow[] | null) ?? []).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const currentToken = current?.session.token;
  const others = (sessions ?? []).filter((s) => s.token !== currentToken).length;

  return (
    <Card>
      <CardTitle extra={<LaptopMinimal className="ml-auto size-4 text-faint" />}>Active sessions</CardTitle>
      <p className="mt-2 text-[13px] text-muted">Devices signed in to your account. Sign out of anything you don&apos;t recognize.</p>
      <ul className="mt-4 grid gap-2">
        {sessions === null
          ? [0, 1].map((i) => <Skeleton key={i} className="h-14" />)
          : sessions.map((s) => {
              const d = deviceOf(s.userAgent);
              const isCurrent = s.token === currentToken;
              const Icon = d.mobile ? Smartphone : LaptopMinimal;
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-3.5 py-2.5">
                  <Icon className="size-5 flex-none text-muted" />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px]">
                      {d.label || "Unknown device"} {isCurrent ? <Badge tone="green" className="ml-1.5 align-middle">This device</Badge> : null}
                    </b>
                    <span className="block truncate text-xs text-muted" suppressHydrationWarning>
                      {showIp(s.ipAddress) ? `${s.ipAddress} · ` : ""}active {timeAgo(s.updatedAt)}
                    </span>
                  </div>
                  {!isCurrent ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === s.token}
                      onClick={async () => {
                        setBusy(s.token);
                        const { error } = await authClient.revokeSession({ token: s.token });
                        setBusy(null);
                        if (error) return void toast.error(authErrorMessage(error));
                        toast.success("Session signed out");
                        void load();
                      }}
                    >
                      <LogOut /> Sign out
                    </Button>
                  ) : null}
                </li>
              );
            })}
      </ul>
      {others > 0 ? (
        <Button
          className="mt-4"
          loading={busy === "others"}
          onClick={async () => {
            setBusy("others");
            const { error } = await authClient.revokeOtherSessions();
            setBusy(null);
            if (error) return void toast.error(authErrorMessage(error));
            toast.success("Signed out of all other sessions");
            void load();
          }}
        >
          Sign out of {others} other session{others > 1 ? "s" : ""}
        </Button>
      ) : null}
    </Card>
  );
}

export function DangerSection({ user, planCount }: { user: SettingsUser; planCount: number }) {
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ready = confirm.trim().toLowerCase() === user.email.toLowerCase() && (!user.hasPassword || password.length > 0);

  return (
    <Card className="border-red/35">
      <CardTitle extra={<Trash2 className="ml-auto size-4 text-red" />}>Delete account</CardTitle>
      <p className="mt-2 text-[13px] text-muted">
        Permanently deletes your account and your {planCount} saved plan{planCount === 1 ? "" : "s"}. Share links stop working. This can&apos;t be undone.
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Delete your account?" description={`Your account, ${planCount} plan${planCount === 1 ? "" : "s"} and all share links are removed for good.`}>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ready) return;
              setPending(true);
              setError(null);
              const { error: err } = await authClient.deleteUser(user.hasPassword ? { password } : {});
              setPending(false);
              if (err) return setError(authErrorMessage(err));
              // full reload so no page from the deleted account stays mounted
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign("/");
            }}
          >
            <FormError message={error} />
            <Field label={<>Type your email ({user.email}) to confirm</>} htmlFor="del-email">
              <Input id="del-email" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            </Field>
            {user.hasPassword ? (
              <div className="grid content-start gap-1.5">
                <Label htmlFor="del-pw">Password</Label>
                <PasswordInput id="del-pw" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            ) : null}
            <DialogFooter className="mt-1">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" loading={pending} disabled={!ready}>
                Delete account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
