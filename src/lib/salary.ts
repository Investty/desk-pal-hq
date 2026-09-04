export interface SalaryComponents {
  basic: number;
  da: number;
  hra: number;
  special_allowance: number;
  pf_rate: number;
  professional_tax: number;
  tds: number;
}

export interface SalaryBreakdown extends SalaryComponents {
  pf: number;
  gross: number;
  deductions: number;
  net: number;
}

const n = (v: unknown) => Number(v ?? 0) || 0;
const round = (v: number) => Math.round(v * 100) / 100;

/** Statutory-style monthly salary math: PF = pf_rate% of (Basic + DA). */
export function computeSalary(s: Partial<SalaryComponents> | null | undefined): SalaryBreakdown {
  const basic = n(s?.basic);
  const da = n(s?.da);
  const hra = n(s?.hra);
  const special_allowance = n(s?.special_allowance);
  const pf_rate = s?.pf_rate === undefined || s?.pf_rate === null ? 12 : n(s.pf_rate);
  const professional_tax = n(s?.professional_tax);
  const tds = n(s?.tds);

  const gross = round(basic + da + hra + special_allowance);
  const pf = round(((basic + da) * pf_rate) / 100);
  const deductions = round(pf + professional_tax + tds);

  return {
    basic, da, hra, special_allowance, pf_rate, professional_tax, tds,
    pf, gross, deductions, net: round(gross - deductions),
  };
}

export const formatINR = (v: number) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
