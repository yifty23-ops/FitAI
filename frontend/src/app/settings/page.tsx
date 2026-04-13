"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, fetchUserMe, clearToken } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Tier } from "@/lib/tiers";

interface ProfileData {
  id: string;
  goal: string;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  sex: string;
  experience: string;
  days_per_week: number | null;
  session_minutes: number | null;
  equipment: string[] | null;
  injuries: string | null;
  sleep_hours: number | null;
  stress_level: number | null;
  job_activity: string | null;
  diet_style: string | null;
  sport: string | null;
  competition_date: string | null;
}

const GOAL_OPTIONS = ["fat_loss", "muscle", "performance", "wellness"];
const SEX_OPTIONS = ["male", "female"];
const EXPERIENCE_OPTIONS = ["beginner", "intermediate", "advanced"];
const JOB_ACTIVITY_OPTIONS = ["sedentary", "light", "active"];
const DIET_OPTIONS = ["omnivore", "vegetarian", "vegan", "keto", "halal", "other"];
const EQUIPMENT_OPTIONS = [
  { id: "barbell", label: "Barbell" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "kettlebells", label: "Kettlebells" },
  { id: "pull_up_bar", label: "Pull-up Bar" },
  { id: "cables", label: "Cables" },
  { id: "machines", label: "Machines" },
  { id: "bands", label: "Resistance Bands" },
  { id: "bodyweight_only", label: "Bodyweight Only" },
];

const TIER_BADGE_STYLES: Record<string, string> = {
  free: "bg-zinc-700 text-zinc-200",
  pro: "bg-blue-600 text-white",
  elite: "bg-amber-600 text-white",
};

const INPUT_CLASS =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500";

const SELECT_CLASS =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userTier, setUserTier] = useState<Tier>("free");

  // Profile state
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push("/");
      return;
    }

    async function load() {
      const me = await fetchUserMe();
      if (!me) {
        router.push("/");
        return;
      }
      setUserEmail(me.email);
      setUserTier(me.tier as Tier);

      try {
        const p = await api<ProfileData | null>("/profile");
        if (p) setProfile(p);
      } catch {
        // No profile yet — that's fine
      }
      setLoading(false);
    }

    load();
  }, [router]);

  function updateProfile<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleEquipment(id: string) {
    if (!profile) return;
    const current = profile.equipment ?? [];
    if (id === "bodyweight_only") {
      updateProfile("equipment", current.includes("bodyweight_only") ? [] : ["bodyweight_only"]);
    } else {
      const without = current.filter((e) => e !== "bodyweight_only" && e !== id);
      if (current.includes(id)) {
        updateProfile("equipment", without);
      } else {
        updateProfile("equipment", [...without, id]);
      }
    }
  }

  async function saveProfile() {
    if (!profile) return;
    setProfileSaving(true);
    setProfileMsg("");
    setProfileError("");
    try {
      const body = {
        goal: profile.goal,
        age: profile.age,
        weight_kg: profile.weight_kg,
        height_cm: profile.height_cm,
        sex: profile.sex,
        experience: profile.experience,
        days_per_week: profile.days_per_week,
        session_minutes: profile.session_minutes,
        equipment: profile.equipment ?? [],
        injuries: profile.injuries || null,
        sleep_hours: profile.sleep_hours,
        stress_level: profile.stress_level,
        job_activity: profile.job_activity,
        diet_style: profile.diet_style,
        sport: profile.sport || null,
        competition_date: profile.competition_date || null,
      };
      await api("/profile", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setProfileMsg("Profile saved");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword() {
    setPasswordMsg("");
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setPasswordSaving(true);
    try {
      await api<{ detail: string }>("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setPasswordMsg("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  const tierLabel = userTier.charAt(0).toUpperCase() + userTier.slice(1);
  const badgeStyle = TIER_BADGE_STYLES[userTier] ?? TIER_BADGE_STYLES.free;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Back link */}
        <button
          onClick={() => router.push("/dashboard")}
          className="text-zinc-400 hover:text-white transition-colors text-sm flex items-center gap-1"
        >
          <span>&larr;</span> Back to Dashboard
        </button>

        <h1 className="text-xl font-semibold">Settings</h1>

        {/* ── Profile Section ── */}
        {profile && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-4">
            <h2 className="text-sm font-medium text-zinc-300">Profile</h2>

            <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
              <p className="text-amber-300 text-xs">
                Changes won&apos;t update your active plan. Generate a new plan to see changes.
              </p>
            </div>

            {/* Goal */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Goal</label>
              <select
                value={profile.goal}
                onChange={(e) => updateProfile("goal", e.target.value)}
                className={SELECT_CLASS}
              >
                {GOAL_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Age / Weight / Height */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Age</label>
                <input
                  type="number"
                  min={13}
                  max={100}
                  value={profile.age ?? ""}
                  onChange={(e) => updateProfile("age", parseInt(e.target.value) || null)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  min={30}
                  max={300}
                  step={0.1}
                  value={profile.weight_kg ?? ""}
                  onChange={(e) => updateProfile("weight_kg", parseFloat(e.target.value) || null)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Height (cm)</label>
                <input
                  type="number"
                  min={100}
                  max={250}
                  step={0.1}
                  value={profile.height_cm ?? ""}
                  onChange={(e) => updateProfile("height_cm", parseFloat(e.target.value) || null)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Sex */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Sex</label>
              <div className="flex gap-2">
                {SEX_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateProfile("sex", s)}
                    className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                      profile.sex === s
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Experience</label>
              <select
                value={profile.experience}
                onChange={(e) => updateProfile("experience", e.target.value)}
                className={SELECT_CLASS}
              >
                {EXPERIENCE_OPTIONS.map((exp) => (
                  <option key={exp} value={exp}>
                    {exp.charAt(0).toUpperCase() + exp.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Days per week / Session minutes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Days per week</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => updateProfile("days_per_week", d)}
                      className={`w-8 h-8 rounded-lg font-medium text-xs transition-colors ${
                        profile.days_per_week === d
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Session (min)</label>
                <select
                  value={profile.session_minutes ?? ""}
                  onChange={(e) => updateProfile("session_minutes", parseInt(e.target.value) || null)}
                  className={SELECT_CLASS}
                >
                  <option value="">--</option>
                  {[30, 45, 60, 75, 90].map((m) => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Equipment */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Equipment</label>
              <div className="grid grid-cols-2 gap-2">
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => toggleEquipment(eq.id)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                      profile.equipment?.includes(eq.id)
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {eq.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Injuries */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Injuries / limitations</label>
              <input
                type="text"
                value={profile.injuries ?? ""}
                onChange={(e) => updateProfile("injuries", e.target.value || null)}
                className={INPUT_CLASS}
                placeholder="e.g. bad knee, shoulder issue"
              />
            </div>

            {/* Sleep / Stress */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Sleep (hours)</label>
                <input
                  type="number"
                  min={3}
                  max={12}
                  step={0.5}
                  value={profile.sleep_hours ?? ""}
                  onChange={(e) => updateProfile("sleep_hours", parseFloat(e.target.value) || null)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Stress level</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateProfile("stress_level", s)}
                      className={`w-8 h-8 rounded-lg font-medium text-xs transition-colors ${
                        profile.stress_level === s
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Job activity */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Daily activity level</label>
              <div className="flex gap-2">
                {JOB_ACTIVITY_OPTIONS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => updateProfile("job_activity", a)}
                    className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                      profile.job_activity === a
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Diet */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Diet style</label>
              <div className="grid grid-cols-3 gap-2">
                {DIET_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateProfile("diet_style", d)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      profile.diet_style === d
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            {profileError && <p className="text-red-400 text-sm">{profileError}</p>}
            {profileMsg && <p className="text-green-400 text-sm">{profileMsg}</p>}

            <button
              onClick={saveProfile}
              disabled={profileSaving}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-colors"
            >
              {profileSaving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}

        {/* ── Account Section ── */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-medium text-zinc-300">Account</h2>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              value={userEmail}
              readOnly
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-400 cursor-not-allowed"
            />
          </div>

          {/* Change password */}
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">Change password</p>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className={INPUT_CLASS}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              className={INPUT_CLASS}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className={INPUT_CLASS}
            />

            {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
            {passwordMsg && <p className="text-green-400 text-sm">{passwordMsg}</p>}

            <button
              onClick={changePassword}
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-colors"
            >
              {passwordSaving ? "Changing..." : "Change Password"}
            </button>
          </div>
        </div>

        {/* ── Tier Section ── */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Subscription</h2>
          <div className="flex items-center gap-3">
            <span className={`${badgeStyle} rounded-lg px-3 py-1.5 text-xs font-medium`}>
              {tierLabel}
            </span>
            <span className="text-sm text-zinc-400">Current plan</span>
          </div>
          {userTier !== "elite" && (
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl font-medium text-sm text-white transition-colors"
            >
              Upgrade Plan
            </button>
          )}
        </div>

        {/* ── Danger Zone ── */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-red-400">Danger Zone</h2>
          <button
            onClick={() => {
              clearToken();
              router.push("/");
            }}
            className="w-full py-3 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 rounded-xl font-medium text-sm text-red-300 transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
