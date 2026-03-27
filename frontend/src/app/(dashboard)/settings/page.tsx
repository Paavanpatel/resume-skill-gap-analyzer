"use client";

import { useState, useCallback, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Shield, SlidersHorizontal, Trash2, CreditCard } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import {
  deleteAccount,
  getErrorMessage,
  updatePassword,
  updatePreferences,
  updateProfile,
  getUsageSummary,
  createPortalSession,
  type UsageSummary,
} from "@/lib/api";
import Tabs, { TabPanel } from "@/components/ui/Tabs";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import PasswordStrengthMeter from "@/components/ui/PasswordStrengthMeter";
import { useToast } from "@/components/ui/Toast";

// ── Tier badge ───────────────────────────────────────────────

const tierColors = {
  free: "bg-gray-100 dark:bg-surface-700 text-gray-600 dark:text-gray-300",
  pro: "bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300",
  enterprise:
    "bg-warning-100 dark:bg-warning-900/40 text-warning-700 dark:text-warning-300",
};

function TierBadge({ tier }: { tier: "free" | "pro" | "enterprise" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tierColors[tier]}`}
    >
      {tier}
    </span>
  );
}

// ── Avatar initials ──────────────────────────────────────────

function AvatarInitials({ user }: { user: { full_name: string | null; email: string } }) {
  const initials = user.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0]?.toUpperCase() || "U";

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full gradient-primary text-xl font-bold text-white select-none">
      {initials}
    </div>
  );
}

// ── Profile tab ──────────────────────────────────────────────

function ProfileTab() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [errors, setErrors] = useState<{ full_name?: string; email?: string }>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;

    const next: { full_name?: string | null; email?: string } = {};
    if (fullName !== (user.full_name ?? "")) next.full_name = fullName.trim() || null;
    if (email !== user.email) next.email = email.trim();

    if (!Object.keys(next).length) {
      toast("No changes to save.", "info");
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const updated = await updateProfile(next);
      updateUser(updated);
      toast("Profile saved.", "success");
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg.toLowerCase().includes("email")) {
        setErrors({ email: msg });
      } else {
        toast(msg, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-lg">
      {/* Avatar + tier */}
      <div className="flex items-center gap-4">
        <AvatarInitials user={user} />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {user.full_name || user.email}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <TierBadge tier={user.tier} />
            {user.is_verified && (
              <span className="text-xs text-success-600 dark:text-success-400">Verified</span>
            )}
          </div>
        </div>
      </div>

      <div className="h-px bg-gray-200 dark:bg-surface-700" />

      {/* Form */}
      <Input
        label="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Your name"
        error={errors.full_name}
      />
      <Input
        label="Email address"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        error={errors.email}
      />

      <Button onClick={handleSave} isLoading={saving}>
        Save changes
      </Button>
    </div>
  );
}

// ── Security tab ─────────────────────────────────────────────

function SecurityTab() {
  const { logout } = useAuth();
  const { toast } = useToast();

  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    const next: typeof errors = {};
    if (!current) next.current = "Required.";
    if (newPwd.length < 8) next.new = "Minimum 8 characters.";
    if (newPwd !== confirm) next.confirm = "Passwords do not match.";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await updatePassword({ current_password: current, new_password: newPwd });
      toast("Password changed. Please log in again.", "success", 6000);
      // Auto-logout for security
      setTimeout(() => logout(), 1500);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg.toLowerCase().includes("current")) {
        setErrors({ current: msg });
      } else {
        toast(msg, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Change password
        </h3>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          You will be logged out after a successful change.
        </p>
      </div>

      <Input
        label="Current password"
        type="password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        autoComplete="current-password"
        error={errors.current}
      />
      <div className="space-y-2">
        <Input
          label="New password"
          type="password"
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          autoComplete="new-password"
          error={errors.new}
        />
        <PasswordStrengthMeter password={newPwd} />
      </div>
      <Input
        label="Confirm new password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        error={errors.confirm}
      />

      <Button onClick={handleChange} isLoading={saving}>
        Update password
      </Button>
    </div>
  );
}

// ── Preferences tab ──────────────────────────────────────────

const AI_PROVIDERS = [
  { value: "auto", label: "Auto (recommended)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
] as const;

function PreferencesTab() {
  const { user, updateUser } = useAuth();
  const { setTheme, theme } = useTheme();
  const { toast } = useToast();

  const prefs = user?.preferences ?? {};
  const [emailNotifications, setEmailNotifications] = useState(
    prefs.email_notifications !== false
  );
  const [aiProvider, setAiProvider] = useState<string>(
    (prefs.ai_provider as string) ?? "auto"
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updatePreferences({
        email_notifications: emailNotifications,
        ai_provider: aiProvider,
      });
      updateUser(updated);
      toast("Preferences saved.", "success");
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* Theme */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Appearance
        </h3>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                theme === t
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                  : "border-gray-200 dark:border-surface-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          Theme is applied immediately and also saved to your profile.
        </p>
      </div>

      <div className="h-px bg-gray-200 dark:bg-surface-700" />

      {/* Notifications */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Notifications
        </h3>
        <Toggle
          checked={emailNotifications}
          onChange={setEmailNotifications}
          label="Email notifications"
          description="Receive email updates about completed analyses and account activity."
        />
      </div>

      <div className="h-px bg-gray-200 dark:bg-surface-700" />

      {/* AI provider */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          AI provider
        </h3>
        <div className="space-y-2">
          {AI_PROVIDERS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="ai_provider"
                value={value}
                checked={aiProvider === value}
                onChange={() => setAiProvider(value)}
                className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} isLoading={saving}>
        Save preferences
      </Button>
    </div>
  );
}

// ── Account tab ──────────────────────────────────────────────

function AccountTab() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({});
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const next: typeof errors = {};
    if (!password) next.password = "Required.";
    if (confirmation !== "DELETE") next.confirmation = 'Type exactly "DELETE" to confirm.';
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setErrors({});
    setDeleting(true);
    try {
      await deleteAccount({ password, confirmation });
      toast("Account deactivated. Goodbye.", "info", 6000);
      await logout();
      router.replace("/login");
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg.toLowerCase().includes("password")) {
        setErrors({ password: msg });
      } else {
        toast(msg, "error");
      }
    } finally {
      setDeleting(false);
    }
  };

  const resetModal = useCallback(() => {
    setModalOpen(false);
    setPassword("");
    setConfirmation("");
    setErrors({});
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-lg">
      {/* Account info */}
      <div className="rounded-xl border border-gray-200 dark:border-surface-700 p-4 space-y-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">Account ID:</span>{" "}
          <span className="font-mono text-xs">{user.id}</span>
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">Member since:</span>{" "}
          {new Date(user.created_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">Plan:</span>{" "}
          <TierBadge tier={user.tier} />
        </p>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Trash2 className="h-5 w-5 text-danger-600 dark:text-danger-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-danger-800 dark:text-danger-300">
              Delete account
            </h3>
            <p className="mt-0.5 text-xs text-danger-700 dark:text-danger-400">
              This will deactivate your account. Your data is retained for compliance but
              you will no longer be able to log in.
            </p>
          </div>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setModalOpen(true)}
        >
          Delete my account
        </Button>
      </div>

      {/* Confirmation modal */}
      <Modal
        isOpen={modalOpen}
        onClose={resetModal}
        title="Delete account"
        description="This action cannot be undone. Your account will be permanently deactivated."
        size="md"
      >
        <div className="space-y-4 mt-2">
          <Input
            label="Confirm your password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            error={errors.password}
          />
          <div className="space-y-1.5">
            <Input
              label={`Type "DELETE" to confirm`}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
              error={errors.confirmation}
            />
            {confirmation && confirmation !== "DELETE" && (
              <p className="text-xs text-danger-600 dark:text-danger-400">
                Must match exactly: DELETE
              </p>
            )}
          </div>
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={resetModal} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleting}
            disabled={confirmation !== "DELETE"}
          >
            Delete account
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// ── Billing tab ──────────────────────────────────────────────

function BillingTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    getUsageSummary().then(setUsage).catch(() => {});
  }, []);

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setPortalLoading(false);
    }
  }

  if (!user) return null;

  const tierLabel =
    user.tier === "free"
      ? "Free"
      : user.tier === "pro"
        ? "Pro — $12/mo"
        : "Enterprise — $49/mo";

  return (
    <div className="space-y-6 max-w-lg">
      {/* Current plan */}
      <div className="rounded-xl border border-gray-200 dark:border-surface-700 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Current plan
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TierBadge tier={user.tier} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {tierLabel}
            </span>
          </div>
          {user.tier === "free" ? (
            <a
              href="/pricing"
              className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              Upgrade →
            </a>
          ) : (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-60"
            >
              {portalLoading ? "Opening…" : "Manage Subscription →"}
            </button>
          )}
        </div>
      </div>

      {/* Usage chart */}
      {usage && usage.tier !== "enterprise" && (
        <div className="rounded-xl border border-gray-200 dark:border-surface-700 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Usage — {usage.period}
          </h3>
          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span>Analyses</span>
              <span>
                {usage.analyses.used} / {usage.analyses.limit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-surface-700">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  usage.analyses.pct >= 90
                    ? "bg-danger-500"
                    : usage.analyses.pct >= 70
                      ? "bg-warning-500"
                      : "bg-primary-500"
                }`}
                style={{ width: `${Math.min(usage.analyses.pct, 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              Resets on the 1st of next month.
            </p>
          </div>
        </div>
      )}

      {/* Enterprise unlimited note */}
      {usage?.tier === "enterprise" && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Your Enterprise plan includes unlimited analyses.
        </p>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

const TABS = [
  { id: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
  { id: "security", label: "Security", icon: <Shield className="h-4 w-4" /> },
  {
    id: "preferences",
    label: "Preferences",
    icon: <SlidersHorizontal className="h-4 w-4" />,
  },
  {
    id: "billing",
    label: "Billing",
    icon: <CreditCard className="h-4 w-4" />,
  },
  { id: "account", label: "Account", icon: <Trash2 className="h-4 w-4" /> },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") ?? "profile"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your profile, security, and preferences.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-6">
        <Tabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          variant="underline"
        >
          <TabPanel id="profile" activeTab={activeTab}>
            <ProfileTab />
          </TabPanel>
          <TabPanel id="security" activeTab={activeTab}>
            <SecurityTab />
          </TabPanel>
          <TabPanel id="preferences" activeTab={activeTab}>
            <PreferencesTab />
          </TabPanel>
          <TabPanel id="billing" activeTab={activeTab}>
            <BillingTab />
          </TabPanel>
          <TabPanel id="account" activeTab={activeTab}>
            <AccountTab />
          </TabPanel>
        </Tabs>
      </div>
    </div>
  );
}
