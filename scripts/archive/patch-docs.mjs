import { readFileSync, writeFileSync } from 'fs'

// ── docs/page.tsx — update Fee Model section ─────────────────────────────────
{
  let c = readFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/docs/page.tsx', 'utf8')

  // Replace the Registration (Free) / Staking (Platform Fee) split with unified table
  c = c.replace(
    `              <p className="text-[#9BA5B0] text-sm leading-relaxed mb-5">
                AgentScore uses a hybrid fee model — registration is free, platform fees apply only on staking.
              </p>

              <div className="grid sm:grid-cols-3 gap-4 mb-5">
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.2)' }}>
                  <div className="text-sm font-bold text-[#2ECC71] mb-2">Registration — Free</div>
                  <p className="text-[#9BA5B0] text-xs leading-relaxed">
                    Creating agents, skills, and claims goes directly through Intuition MultiVault.
                    No platform fee. The registering wallet becomes the on-chain creator.
                  </p>
                  <div className="mt-2 text-xs text-[#7A838D]">~0.002 tTRUST (protocol fee only)</div>
                </div>
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(200,150,60,0.06)', border: '1px solid rgba(200,150,60,0.2)' }}>
                  <div className="text-sm font-bold text-[#C8963C] mb-2">Staking — Platform Fee</div>
                  <p className="text-[#9BA5B0] text-xs leading-relaxed">
                    Support / Oppose routes through our FeeProxy contract which collects fees atomically.
                  </p>
                  <table className="mt-2 w-full text-xs">
                    <tbody>
                      <tr><td className="text-[#7A838D] py-0.5">Fixed fee</td><td className="text-white text-right">0.1 tTRUST</td></tr>
                      <tr><td className="text-[#7A838D] py-0.5">Percentage</td><td className="text-white text-right">2.5%</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.2)' }}>
                  <div className="text-sm font-bold text-[#2ECC71] mb-2">Redeem — Free</div>
                  <p className="text-[#9BA5B0] text-xs leading-relaxed">
                    Redeeming shares goes directly through MultiVault. No platform fee.
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-4 mb-4"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-xs font-bold text-[#B5BDC6] mb-2">Example: Staking 1 tTRUST</div>
                <div className="space-y-1 text-xs text-[#9BA5B0]">
                  <div className="flex justify-between"><span>You send</span><span className="text-white">~1.126 tTRUST</span></div>
                  <div className="flex justify-between"><span>Platform fee</span><span className="text-[#C8963C]">~0.126 tTRUST</span></div>
                  <div className="flex justify-between"><span>Deposited to vault</span><span className="text-[#2ECC71]">1.0 tTRUST</span></div>
                </div>
              </div>`,
    `              <p className="text-[#9BA5B0] text-sm leading-relaxed mb-5">
                All write operations (registration, staking, claims) route through our FeeProxy contract.
                A platform fee is collected atomically on every operation. Reading data is always free.
              </p>

              <div className="rounded-xl overflow-hidden mb-5"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <th className="text-left px-4 py-2.5 text-[#7A838D] font-semibold text-xs uppercase tracking-wider">Operation</th>
                      <th className="text-right px-4 py-2.5 text-[#7A838D] font-semibold text-xs uppercase tracking-wider">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { op: 'Agent registration (createAtom)', fee: '0.1 tTRUST + 2.5%', color: '#C8963C' },
                      { op: 'Skill registration (createAtom)', fee: '0.1 tTRUST + 2.5%', color: '#2EE6D6' },
                      { op: 'Claim / Triple creation', fee: '0.1 tTRUST + 2.5%', color: '#38B6FF' },
                      { op: 'Staking Support / Oppose', fee: '0.1 tTRUST + 2.5%', color: '#C8963C' },
                      { op: 'Redeem / Sell shares', fee: 'FREE', color: '#2ECC71' },
                      { op: 'Reading data', fee: 'FREE', color: '#2ECC71' },
                    ].map((row, i) => (
                      <tr key={row.op} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td className="px-4 py-2.5 text-[#9BA5B0]">{row.op}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-xs" style={{ color: row.color }}>{row.fee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl p-4 mb-4"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-xs font-bold text-[#B5BDC6] mb-2">Example: Staking 1 tTRUST</div>
                <div className="space-y-1 text-xs text-[#9BA5B0]">
                  <div className="flex justify-between"><span>You send</span><span className="text-white">~1.126 tTRUST</span></div>
                  <div className="flex justify-between"><span>Platform fee</span><span className="text-[#C8963C]">~0.126 tTRUST</span></div>
                  <div className="flex justify-between"><span>Deposited to vault</span><span className="text-[#2ECC71]">1.0 tTRUST</span></div>
                </div>
              </div>`
  )

  writeFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/docs/page.tsx', c)
  console.log('docs/page.tsx patched')
}
