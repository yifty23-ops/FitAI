"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, fetchUserMe, clearToken } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Tier } from "@/lib/tiers";
import { canUse } from "@/lib/tiers";

interface StrengthBenchmark {
  weight: number;
  reps: number;
}

interface ProfileData {
  id: string;
  goal: string;
  goal_sub_category: string | null;
  body_fat_est: string | null;
  goal_deadline: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  sex: string;
  experience: string;
  training_age_years: number | null;
  training_recency: string | null;
  days_per_week: number | null;
  training_days_specific: string[] | null;
  session_minutes: number | null;
  equipment: string[] | null;
  injuries: string | null;
  injury_ortho_history: string | null;
  current_pain_level: number | null;
  chair_stand_proxy: boolean | null;
  overhead_reach_proxy: boolean | null;
  exercise_blacklist: string[] | null;
  sleep_hours: number | null;
  stress_level: number | null;
  job_activity: string | null;
  protein_intake_check: string | null;
  diet_style: string | null;
  current_max_bench: StrengthBenchmark | null;
  current_max_squat: StrengthBenchmark | null;
  current_max_deadlift: StrengthBenchmark | null;
  sport: string | null;
  competition_date: string | null;
  sport_phase: string | null;
  sport_weekly_hours: number | null;
}

const GOAL_OPTIONS = ["fat_loss", "muscle", "performance", "wellness"];
const GOAL_SUB_OPTIONS: Record<string, string[]> = {
  fat_loss: ["cut", "recomp"],
  muscle: ["hypertrophy", "strength", "powerbuilding"],
  performance: ["power", "endurance", "sport"],
  wellness: ["longevity", "rehab"],
};
const BODY_FAT_OPTIONS = ["<10%", "10-15%", "15-20%", "20-25%", "25%+"];
const SEX_OPTIONS = ["male", "female"];
const EXPERIENCE_OPTIONS = ["beginner", "intermediate", "advanced"];
const TRAINING_RECENCY_OPTIONS = ["current", "1_month", "3_months", "6_months", "1_year", "2_years_plus"];
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const JOB_ACTIVITY_OPTIONS = ["sedentary", "light", "moderate", "heavy_labor"];
const PROTEIN_OPTIONS = ["yes", "no", "unsure"];
const DIET_OPTIONS = ["omnivore", "vegetarian", "vegan", "keto", "halal", "other"];
const SPORT_PHASE_OPTIONS = ["off_season", "pre_season", "in_season"];
const EQUIPMENT_OPTIONS = [
  { id: "barbell", label: "Barbell" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "kettlebells", label: "Kettlebells" },
  { id: "pull_up_bar", label: "Pull-up Bar" },
  { id: "cables", label: "Cables" },
  { id: "machines", label: "Machines" },
  { id: "bands", label: "Resistance Bands" },
  { id: "squat_rack", label: "Squat Rack" },
  { id: "bench", label: "Adjustable Bench" },
  { id: "bodyweight_only", label: "Bodyweight Only" },
];
const EXERCISE_BLACKLIST_OPTIONS = [
  "Barbell Back Squat", "Conventional Deadlift", "Barbell Bench Press",
  "Overhead Press", "Barbell Row", "Pull-ups", "Lunges",
  "Leg Press", "Romanian Deadlift", "Dips", "Front Squat", "Hip Thrust",
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

function PillBtn({ selected, onClick, children, className = "" }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
        selected ? "bg-blue-600 text-white" : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userTier, setUserTier] = useState<Tier>("free");

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    const user = getUser();
    if (!user) { router.push("/"); return; }

    async function load() {
      const me = await fetchUserMe();
      if (!me) { router.push("/"); return; }
      setUserEmail(me.email);
      setUserTier(me.tier as Tier);

      try {
        const p = await api<ProfileData | null>("/profile");
        if (p) setProfile(p);
      } catch { /* No profile yet */ }
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
      updateProfile("equipment", current.includes(id) ? without : [...without, id]);
    }
  }

  function toggleDay(id: string) {
    if (!profile) return;
    const current = profile.training_days_specific ?? [];
    updateProfile("training_days_specific", current.includes(id) ? current.filter((d) => d !== id) : [...current, id]);
  }

  function toggleBlacklist(ex: string) {
    if (!profile) return;
    const current = profile.exercise_blacklist ?? [];
    updateProfile("exercise_blacklist", current.includes(ex) ? current.filter((e) => e !== ex) : [...current, ex]);
  }

  async function saveProfile() {
    if (!profile) return;
    setProfileSaving(true);
    setProfileMsg("");
    setProfileError("");
    try {
      const daysSpecific = profile.training_days_specific ?? [];
      const body = {
        goal: profile.goal,
        goal_sub_category: profile.goal_sub_category || null,
        body_fat_est: profile.body_fat_est || null,
        goal_deadline: profile.goal_deadline || null,
        age: profile.age,
        weight_kg: profile.weight_kg,
        height_cm: profile.height_cm,
        sex: profile.sex,
        experience: profile.experience,
        training_age_years: profile.training_age_years,
        training_recency: profile.training_recency,
        days_per_week: daysSpecific.length || profile.days_per_week,
        training_days_specific: daysSpecific.length > 0 ? daysSpecific : null,
        session_minutes: profile.session_minutes,
        equipment: profile.equipment ?? [],
        injuries: profile.injury_ortho_history || profile.injuries || null,
        injury_ortho_history: profile.injury_ortho_history || null,
        current_pain_level: profile.current_pain_level,
        chair_stand_proxy: profile.chair_stand_proxy,
        overhead_reach_proxy: profile.overhead_reach_proxy,
        exercise_blacklist: profile.exercise_blacklist,
        sleep_hours: profile.sleep_hours,
        stress_level: profile.stress_level,
        job_activity: profile.job_activity,
        protein_intake_check: profile.protein_intake_check,
        diet_style: profile.diet_style,
        current_max_bench: profile.current_max_bench?.weight ? profile.current_max_bench : null,
        current_max_squat: profile.current_max_squat?.weight ? profile.current_max_squat : null,
        current_max_deadlift: profile.current_max_deadlift?.weight ? profile.current_max_deadlift : null,
        sport: profile.sport || null,
        competition_date: profile.competition_date || null,
        sport_phase: profile.sport_phase || null,
        sport_weekly_hours: profile.sport_weekly_hours,
      };
      await api("/profile", { method: "POST", body: JSON.stringify(body) });
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
    if (newPassword !== confirmPassword) { setPasswordError("New passwords do not match"); return; }
    if (newPassword.length < 8) { setPasswordError("New password must be at least 8 characters"); return; }
    setPasswordSaving(true);
    try {
      await api<{ detail: string }>("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setPasswordMsg("Password changed");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally { setPasswordSaving(false); }
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
  const showBenchmarks = canUse(userTier, "web_search") && profile?.experience !== "beginner";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
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

            {/* Goal + Sub-category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Goal</label>
                <select value={profile.goal} onChange={(e) => { updateProfile("goal", e.target.value); updateProfile("goal_sub_category", null); }} className={SELECT_CLASS}>
                  {GOAL_OPTIONS.map((g) => <option key={g} value={g}>{g.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Focus</label>
                <select value={profile.goal_sub_category ?? ""} onChange={(e) => updateProfile("goal_sub_category", e.target.value || null)} className={SELECT_CLASS}>
                  <option value="">--</option>
                  {(GOAL_SUB_OPTIONS[profile.goal] ?? []).map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>

            {/* Body fat + Goal deadline */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Body fat est.</label>
                <select value={profile.body_fat_est ?? ""} onChange={(e) => updateProfile("body_fat_est", e.target.value || null)} className={SELECT_CLASS}>
                  <option value="">--</option>
                  {BODY_FAT_OPTIONS.map((bf) => <option key={bf} value={bf}>{bf}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Goal deadline</label>
                <input type="date" value={profile.goal_deadline ?? ""} onChange={(e) => updateProfile("goal_deadline", e.target.value || null)} className={INPUT_CLASS} />
              </div>
            </div>

            {/* Age / Weight / Height */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Age</label>
                <input type="number" min={13} max={100} value={profile.age ?? ""} onChange={(e) => updateProfile("age", parseInt(e.target.value) || null)} className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Weight (kg)</label>
                <input type="number" min={30} max={300} step={0.1} value={profile.weight_kg ?? ""} onChange={(e) => updateProfile("weight_kg", parseFloat(e.target.value) || null)} className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Height (cm)</label>
                <input type="number" min={100} max={250} step={0.1} value={profile.height_cm ?? ""} onChange={(e) => updateProfile("height_cm", parseFloat(e.target.value) || null)} className={INPUT_CLASS} />
              </div>
            </div>

            {/* Sex */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Sex</label>
              <div className="flex gap-2">
                {SEX_OPTIONS.map((s) => <PillBtn key={s} selected={profile.sex === s} onClick={() => updateProfile("sex", s)} className="flex-1">{s.charAt(0).toUpperCase() + s.slice(1)}</PillBtn>)}
              </div>
            </div>

            {/* Experience + Training Age + Recency */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Experience</label>
                <select value={profile.experience} onChange={(e) => updateProfile("experience", e.target.value)} className={SELECT_CLASS}>
                  {EXPERIENCE_OPTIONS.map((exp) => <option key={exp} value={exp}>{exp.charAt(0).toUpperCase() + exp.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Training years</label>
                <input type="number" min={0} max={50} value={profile.training_age_years ?? ""} onChange={(e) => updateProfile("training_age_years", parseInt(e.target.value) || null)} className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Recency</label>
                <select value={profile.training_recency ?? ""} onChange={(e) => updateProfile("training_recency", e.target.value || null)} className={SELECT_CLASS}>
                  <option value="">--</option>
                  {TRAINING_RECENCY_OPTIONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>

            {/* Strength benchmarks (Pro+ only) */}
            {showBenchmarks && (
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Strength benchmarks</label>
                <div className="space-y-2">
                  {(["bench", "squat", "deadlift"] as const).map((lift) => {
                    const key = `current_max_${lift}` as keyof ProfileData;
                    const val = profile[key] as StrengthBenchmark | null;
                    return (
                      <div key={lift} className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400 w-14 capitalize">{lift}</span>
                        <input type="number" min={0} max={500} placeholder="kg" value={val?.weight ?? ""} onChange={(e) => updateProfile(key as keyof ProfileData, { weight: parseFloat(e.target.value) || 0, reps: val?.reps ?? 1 } as never)} className="w-20 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500" />
                        <span className="text-zinc-500 text-xs">x</span>
                        <input type="number" min={1} max={50} placeholder="reps" value={val?.reps ?? ""} onChange={(e) => updateProfile(key as keyof ProfileData, { weight: val?.weight ?? 0, reps: parseInt(e.target.value) || 1 } as never)} className="w-16 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500" />
                        <span className="text-zinc-500 text-xs">reps</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Training days */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Training days</label>
              <div className="flex gap-1">
                {WEEKDAYS.map((d) => <PillBtn key={d} selected={profile.training_days_specific?.includes(d) ?? false} onClick={() => toggleDay(d)} className="flex-1 text-center">{d.charAt(0).toUpperCase() + d.slice(1, 3)}</PillBtn>)}
              </div>
            </div>

            {/* Session minutes */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Session (min)</label>
              <select value={profile.session_minutes ?? ""} onChange={(e) => updateProfile("session_minutes", parseInt(e.target.value) || null)} className={SELECT_CLASS}>
                <option value="">--</option>
                {[30, 45, 60, 75, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>

            {/* Equipment */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Equipment</label>
              <div className="grid grid-cols-2 gap-2">
                {EQUIPMENT_OPTIONS.map((eq) => <PillBtn key={eq.id} selected={profile.equipment?.includes(eq.id) ?? false} onClick={() => toggleEquipment(eq.id)}>{eq.label}</PillBtn>)}
              </div>
            </div>

            {/* Injury history + Pain */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Injury / surgery history</label>
              <textarea value={profile.injury_ortho_history ?? profile.injuries ?? ""} onChange={(e) => updateProfile("injury_ortho_history", e.target.value || null)} rows={2} className={INPUT_CLASS + " resize-none"} placeholder="e.g. ACL repair 2022, shoulder impingement" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Current pain level: {profile.current_pain_level ?? 0}/10</label>
              <input type="range" min={0} max={10} value={profile.current_pain_level ?? 0} onChange={(e) => updateProfile("current_pain_level", parseInt(e.target.value))} className="w-full accent-blue-500" />
            </div>

            {/* Mobility proxies */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Chair stand test</label>
                <div className="flex gap-1">
                  {[true, false].map((v) => <PillBtn key={String(v)} selected={profile.chair_stand_proxy === v} onClick={() => updateProfile("chair_stand_proxy", v)} className="flex-1">{v ? "Pass" : "Fail"}</PillBtn>)}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Overhead reach</label>
                <div className="flex gap-1">
                  {[true, false].map((v) => <PillBtn key={String(v)} selected={profile.overhead_reach_proxy === v} onClick={() => updateProfile("overhead_reach_proxy", v)} className="flex-1">{v ? "Pass" : "Fail"}</PillBtn>)}
                </div>
              </div>
            </div>

            {/* Exercise blacklist */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Exercises to avoid</label>
              <div className="grid grid-cols-2 gap-1">
                {EXERCISE_BLACKLIST_OPTIONS.map((ex) => <PillBtn key={ex} selected={profile.exercise_blacklist?.includes(ex) ?? false} onClick={() => toggleBlacklist(ex)}>{profile.exercise_blacklist?.includes(ex) ? "\u2713 " : ""}{ex}</PillBtn>)}
              </div>
            </div>

            {/* Sleep / Stress */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Sleep (hours)</label>
                <input type="number" min={3} max={12} step={0.5} value={profile.sleep_hours ?? ""} onChange={(e) => updateProfile("sleep_hours", parseFloat(e.target.value) || null)} className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Stress: {profile.stress_level ?? 5}/10</label>
                <input type="range" min={1} max={10} value={profile.stress_level ?? 5} onChange={(e) => updateProfile("stress_level", parseInt(e.target.value))} className="w-full accent-blue-500 mt-2" />
              </div>
            </div>

            {/* Job activity + Protein + Diet */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Occupational demand</label>
              <div className="flex gap-2">
                {JOB_ACTIVITY_OPTIONS.map((a) => <PillBtn key={a} selected={profile.job_activity === a} onClick={() => updateProfile("job_activity", a)} className="flex-1">{a.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</PillBtn>)}
              </div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Protein intake adequate?</label>
              <div className="flex gap-2">
                {PROTEIN_OPTIONS.map((p) => <PillBtn key={p} selected={profile.protein_intake_check === p} onClick={() => updateProfile("protein_intake_check", p)} className="flex-1">{p.charAt(0).toUpperCase() + p.slice(1)}</PillBtn>)}
              </div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Diet style</label>
              <div className="grid grid-cols-3 gap-2">
                {DIET_OPTIONS.map((d) => <PillBtn key={d} selected={profile.diet_style === d} onClick={() => updateProfile("diet_style", d)}>{d.charAt(0).toUpperCase() + d.slice(1)}</PillBtn>)}
              </div>
            </div>

            {/* Elite sport fields */}
            {userTier === "elite" && (
              <>
                <div className="border-t border-zinc-700 pt-4 mt-2">
                  <h3 className="text-sm font-medium text-amber-400 mb-3">Sport Settings</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Season phase</label>
                    <select value={profile.sport_phase ?? ""} onChange={(e) => updateProfile("sport_phase", e.target.value || null)} className={SELECT_CLASS}>
                      <option value="">--</option>
                      {SPORT_PHASE_OPTIONS.map((sp) => <option key={sp} value={sp}>{sp.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Sport hours/week</label>
                    <input type="number" min={0} max={40} value={profile.sport_weekly_hours ?? ""} onChange={(e) => updateProfile("sport_weekly_hours", parseInt(e.target.value) || null)} className={INPUT_CLASS} />
                  </div>
                </div>
              </>
            )}

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
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email</label>
            <input type="email" value={userEmail} readOnly className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-400 cursor-not-allowed" />
          </div>
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">Change password</p>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className={INPUT_CLASS} />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 8 characters)" className={INPUT_CLASS} />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className={INPUT_CLASS} />
            {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
            {passwordMsg && <p className="text-green-400 text-sm">{passwordMsg}</p>}
            <button onClick={changePassword} disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-colors">
              {passwordSaving ? "Changing..." : "Change Password"}
            </button>
          </div>
        </div>

        {/* ── Tier Section ── */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Subscription</h2>
          <div className="flex items-center gap-3">
            <span className={`${badgeStyle} rounded-lg px-3 py-1.5 text-xs font-medium`}>{tierLabel}</span>
            <span className="text-sm text-zinc-400">Current plan</span>
          </div>
          {userTier !== "elite" && (
            <button onClick={() => router.push("/")} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl font-medium text-sm text-white transition-colors">
              Upgrade Plan
            </button>
          )}
        </div>

        {/* ── Danger Zone ── */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-red-400">Danger Zone</h2>
          <button onClick={() => { clearToken(); router.push("/"); }} className="w-full py-3 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 rounded-xl font-medium text-sm text-red-300 transition-colors">
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
