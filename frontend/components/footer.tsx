// FILE: frontend/components/footer.tsx
import { AlertTriangle } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[#1a3a57] bg-[#0b1929]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

        {/* Medical disclaimer — always visible */}
        <div className="mb-6 rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400 mt-0.5" />
            <div className="text-sm text-amber-300/80 space-y-1">
              <p className="font-semibold text-amber-300">Clinical Disclaimer</p>
              <p>
                HEMOSCOREAPP is a research tool based on the PULSAR XGBoost model.
                Predictions are probabilistic estimates only and do not constitute
                clinical advice, diagnosis, or treatment recommendations.
              </p>
              <p>
                Variable influence scores are non-causal heuristic proxies (ICE-delta
                perturbation method) and should not be interpreted as causal
                contributions. Always apply clinical judgement.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div className="space-y-1">
            <p className="font-semibold text-slate-400">HEMOSCOREAPP</p>
            <p>PULSAR XGBoost · In-hospital mortality · Cardiogenic Shock</p>
            <p>For research and clinical decision support only.</p>
          </div>

          <div className="flex flex-col sm:items-end gap-1">
            <p>Model: PULSAR XGBoost final clinical super</p>
            <p>32 features · 4-tier risk stratification</p>
            <p className="text-slate-600">
              © {new Date().getFullYear()} HEMOSCOREAPP. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
