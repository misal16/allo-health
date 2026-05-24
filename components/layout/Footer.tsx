import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-allo-dark mt-auto">
      <div className="max-w-[1200px] mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="text-white text-lg font-semibold tracking-tight">
              allo<span className="text-allo-accent">.</span>health
            </span>
            <p className="mt-3 text-[13px] text-white/55 leading-relaxed max-w-[200px]">
              India&apos;s first dedicated sexual health platform. Judgement-free care
              for everyone.
            </p>
            {/* Certifications */}
            <div className="mt-4 flex flex-wrap gap-2">
              {["ISO", "NABH", "HIPAA"].map((badge) => (
                <span
                  key={badge}
                  className="text-[11px] font-medium text-allo-trust-text bg-allo-trust-bg px-2 py-0.5 rounded-full"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-white text-[14px] font-medium mb-4">Services</h4>
            <ul className="space-y-2.5">
              {["Consultations", "Diagnostics", "Treatment", "Therapy"].map((s) => (
                <li key={s}>
                  <Link
                    href="/products"
                    className="text-[13px] text-white/55 hover:text-white transition-colors"
                  >
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white text-[14px] font-medium mb-4">Company</h4>
            <ul className="space-y-2.5">
              {["About", "Careers", "Press", "Blog"].map((s) => (
                <li key={s}>
                  <span className="text-[13px] text-white/55 cursor-pointer hover:text-white transition-colors">
                    {s}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white text-[14px] font-medium mb-4">Contact</h4>
            <ul className="space-y-2.5">
              <li className="text-[13px] text-white/55">support@allohealth.com</li>
              <li className="text-[13px] text-white/55">1800-XXX-XXXX (toll-free)</li>
            </ul>
            {/* Social icons */}
            <div className="mt-4 flex gap-2">
              {[
                { label: "Twitter / X", glyph: "𝕏" },
                { label: "LinkedIn", glyph: "in" },
                { label: "Facebook", glyph: "f" },
              ].map(({ label, glyph }) => (
                <button
                  key={label}
                  aria-label={label}
                  className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-[12px] text-white/50 hover:text-white hover:border-white/50 transition-colors"
                >
                  {glyph}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="border-t border-white/[0.08] pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[12px] text-white/35">
            © {new Date().getFullYear()} Allo Health. All rights reserved.
          </p>
          <div className="flex gap-5">
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((l) => (
              <span
                key={l}
                className="text-[12px] text-white/35 hover:text-white/60 cursor-pointer transition-colors"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
