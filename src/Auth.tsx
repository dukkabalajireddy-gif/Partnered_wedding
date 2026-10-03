import { useState } from "react";
import { DEMO_COUPLE, DEMO_OTP, DEMO_VENDOR, INPUT_STYLE, PRIMARY_BTN, normalisePhone, prettyPhone, type Role, type Session } from "./shared";

// Demo sign-in. Any mobile number works and the OTP is always the one shown on screen: nothing is sent or
// checked on a server. It exists so a couple's work is kept under their number, and so a vendor can sign in
// to reply from the vendor desk.

export default function LoginScreen({ role, onLogin, onSwitchRole }: { role: Role; onLogin: (s: Session) => void; onSwitchRole: () => void }) {
  const [step, setStep] = useState<"details" | "otp">("details");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const demo = role === "couple" ? DEMO_COUPLE : DEMO_VENDOR;
  const phone = normalisePhone(mobile);
  const phoneOk = phone.length === 13 && phone.startsWith("+91");
  const emailOk = !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim());

  const sendOtp = () => {
    if (!phoneOk) return setError("Enter a 10-digit mobile number.");
    if (!emailOk) return setError("That email doesn't look right.");
    setError(""); setStep("otp");
  };
  const verify = () => {
    if (otp.trim() !== DEMO_OTP) return setError(`That code isn't right. In demo mode the OTP is ${DEMO_OTP}.`);
    onLogin({ phone, email: email.trim() || undefined });
  };

  return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fdf2f4 0%, #fefdf0 50%, #fdf8f0 100%)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="w-full max-w-md px-4 sm:px-6 py-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#a8213b" }}><span className="text-white text-sm font-bold">P</span></div>
            <span className="text-3xl font-medium tracking-tight" style={{ color: "#a8213b" }}>Partnered</span>
          </div>
          <p className="text-sm font-light" style={{ color: "#c08a0c" }}>{role === "couple" ? "Plan your shaadi, your way" : "Vendor desk · demo"}</p>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 sm:p-8 space-y-5" style={{ border: "1px solid #f5c6d0" }}>
          <div>
            <h1 className="text-2xl font-medium text-gray-800">{step === "details" ? (role === "couple" ? "Log in to your wedding" : "Log in to the vendor desk") : "Enter the OTP"}</h1>
            <p className="text-sm text-gray-700 mt-1">
              {step === "details"
                ? (role === "couple" ? "Your plan is saved under your mobile number, so you won't have to start again." : "Reply to the couples who message you, as the vendor they contacted.")
                : `We sent a code to ${prettyPhone(phone)}.`}
            </p>
          </div>

          {step === "details" ? (
            <div className="space-y-3">
              <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Mobile number
                <div className="mt-1 flex items-stretch gap-2">
                  <span className="rounded-xl px-3 flex items-center text-base text-gray-800 normal-case tracking-normal font-normal" style={INPUT_STYLE}>+91</span>
                  <input value={mobile} onChange={(e) => { setMobile(e.target.value); setError(""); }} inputMode="tel" autoComplete="tel-national" placeholder="98765 43210"
                    className="flex-1 min-w-0 rounded-xl px-4 py-3 text-base normal-case tracking-normal font-normal focus:outline-none" style={INPUT_STYLE} onKeyDown={(e) => e.key === "Enter" && sendOtp()} />
                </div>
              </label>
              <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: "#a8213b" }}>Email (optional)
                <input value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} type="email" autoComplete="email" placeholder="you@example.com"
                  className="mt-1 w-full rounded-xl px-4 py-3 text-base normal-case tracking-normal font-normal focus:outline-none" style={INPUT_STYLE} onKeyDown={(e) => e.key === "Enter" && sendOtp()} />
              </label>
              {error && <div className="text-sm font-medium" style={{ color: "#a8213b" }}>{error}</div>}
              <button onClick={sendOtp} className="w-full text-white rounded-xl py-3.5 font-medium text-sm sparkle-btn" style={PRIMARY_BTN}>Send OTP</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-3 text-sm text-gray-800" style={{ background: "#fffdf0", border: "1px solid #fbf0a1" }}>
                <span className="font-semibold">Demo mode.</span> No SMS is sent. Use the OTP <span className="font-semibold tracking-widest">{DEMO_OTP}</span>.
              </div>
              <input value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" aria-label="OTP"
                className="w-full rounded-xl px-4 py-3 text-xl text-center tracking-[0.5em] focus:outline-none" style={INPUT_STYLE} onKeyDown={(e) => e.key === "Enter" && verify()} autoFocus />
              {error && <div className="text-sm font-medium" style={{ color: "#a8213b" }}>{error}</div>}
              <button onClick={verify} disabled={otp.length !== 6} className="w-full text-white rounded-xl py-3.5 font-medium text-sm disabled:opacity-50" style={PRIMARY_BTN}>Verify and continue</button>
              <button onClick={() => { setStep("details"); setOtp(""); setError(""); }} className="w-full text-sm py-2 text-gray-700 underline">Change number</button>
            </div>
          )}

          <div className="pt-4 space-y-2" style={{ borderTop: "1px solid #fbe8ec" }}>
            <button onClick={() => onLogin({ phone: demo.phone, email: demo.email })} className="w-full rounded-xl py-3 font-medium text-sm" style={{ color: "#a8213b", border: "1px solid #a8213b", background: "#fff" }}>
              Use the demo {role === "couple" ? "couple" : "vendor"} account
            </button>
            <div className="text-xs text-gray-700 text-center">{prettyPhone(demo.phone)} · {demo.email}</div>
          </div>
        </div>

        <div className="text-center mt-5 text-sm">
          <button onClick={onSwitchRole} className="underline text-gray-800 min-h-11 px-2">{role === "couple" ? "I'm a vendor: open the vendor desk" : "I'm planning a wedding: open the couple app"}</button>
        </div>
      </div>
    </div>
  );
}
