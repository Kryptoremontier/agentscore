import { readFileSync, writeFileSync } from 'fs'

// ─────────────────────────────────────────────────────────────────────────────
// RegisterAgentForm.tsx — add fee state + update Registration Cost section
// ─────────────────────────────────────────────────────────────────────────────
{
  let c = readFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/components/agents/RegisterAgentForm.tsx', 'utf8')

  // 1. Add getFeeConfig import
  c = c.replace(
    `import { createWriteConfig, createAgentAtom } from '@/lib/intuition'`,
    `import { createWriteConfig, createAgentAtom, getFeeConfig } from '@/lib/intuition'`
  )

  // 2. Add fee state after const [mounted, setMounted] = useState(false)
  c = c.replace(
    `  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])`,
    `  const [mounted, setMounted] = useState(false)
  const [platformFee, setPlatformFee] = useState<{ fixedFee: bigint; bps: bigint } | null>(null)

  useEffect(() => {
    setMounted(true)
    if (publicClient) {
      getFeeConfig(publicClient).then(setPlatformFee).catch(() => {})
    }
  }, [publicClient])`
  )

  // 3. Replace Registration Cost section in Review step
  c = c.replace(
    `              {/* Registration Fee */}
              <div className="glass rounded-lg p-4 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Registration Cost</p>
                    <p className="text-sm text-text-muted">On-chain atom creation + initial stake</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold font-mono">~0.002 tTRUST</p>
                    <p className="text-xs text-text-muted">atom cost + 0.001 initial deposit + gas</p>
                  </div>
                </div>
              </div>`,
    `              {/* Registration Fee */}
              <div className="glass rounded-lg p-4 border border-primary/20 space-y-2">
                <p className="font-medium">Registration Cost</p>
                {platformFee ? (() => {
                  const depositAmt = 0.001
                  const pctFee = depositAmt * Number(platformFee.bps) / 10000
                  const fixedFee = Number(platformFee.fixedFee) / 1e18
                  const protocolCost = 0.001 // atom creation protocol cost
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-text-muted">
                        <span>Protocol cost</span><span>~{protocolCost.toFixed(3)} tTRUST</span>
                      </div>
                      <div className="flex justify-between text-text-muted">
                        <span>Initial deposit</span><span>{depositAmt.toFixed(3)} tTRUST</span>
                      </div>
                      <div className="flex justify-between text-text-muted">
                        <span>Platform fee ({Number(platformFee.bps)/100}% + {fixedFee.toFixed(3)})</span>
                        <span>{(pctFee + fixedFee).toFixed(4)} tTRUST</span>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t border-white/10 pt-1">
                        <span>Total</span>
                        <span className="font-mono">{(protocolCost + depositAmt + pctFee + fixedFee).toFixed(4)} tTRUST</span>
                      </div>
                    </div>
                  )
                })() : (
                  <p className="text-sm text-text-muted">~0.21 tTRUST (protocol + deposit + fee)</p>
                )}
              </div>`
  )

  writeFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/components/agents/RegisterAgentForm.tsx', c)
  console.log('RegisterAgentForm patched')
}

// ─────────────────────────────────────────────────────────────────────────────
// RegisterSkillForm.tsx — add fee state + update Registration Fee section
// ─────────────────────────────────────────────────────────────────────────────
{
  let c = readFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/components/skills/RegisterSkillForm.tsx', 'utf8')

  // 1. Add getFeeConfig import
  c = c.replace(
    `import { createWriteConfig, createSkillAtom } from '@/lib/intuition'`,
    `import { createWriteConfig, createSkillAtom, getFeeConfig } from '@/lib/intuition'`
  )

  // 2. Add fee state + effect
  c = c.replace(
    `  const [errors, setErrors] = useState<Record<string, string>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])`,
    `  const [errors, setErrors] = useState<Record<string, string>>({})
  const [mounted, setMounted] = useState(false)
  const [platformFee, setPlatformFee] = useState<{ fixedFee: bigint; bps: bigint } | null>(null)

  useEffect(() => {
    setMounted(true)
    if (publicClient) {
      getFeeConfig(publicClient).then(setPlatformFee).catch(() => {})
    }
  }, [publicClient])`
  )

  // 3. Replace Registration Fee box in Review step
  c = c.replace(
    `              {/* Registration Fee */}
              <div className="glass rounded-lg p-4 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Registration Fee</p>
                    <p className="text-sm text-text-muted">One-time Atom creation</p>
                  </div>
                  <p className="text-2xl font-bold font-mono">0.01 tTRUST</p>
                </div>
              </div>`,
    `              {/* Registration Fee */}
              <div className="glass rounded-lg p-4 border border-primary/20 space-y-2">
                <p className="font-medium">Registration Fee</p>
                {platformFee ? (() => {
                  const depositAmt = 0.001
                  const pctFee = depositAmt * Number(platformFee.bps) / 10000
                  const fixedFee = Number(platformFee.fixedFee) / 1e18
                  const protocolCost = 0.001
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-text-muted">
                        <span>Protocol cost</span><span>~{protocolCost.toFixed(3)} tTRUST</span>
                      </div>
                      <div className="flex justify-between text-text-muted">
                        <span>Initial deposit</span><span>{depositAmt.toFixed(3)} tTRUST</span>
                      </div>
                      <div className="flex justify-between text-text-muted">
                        <span>Platform fee ({Number(platformFee.bps)/100}% + {fixedFee.toFixed(3)})</span>
                        <span>{(pctFee + fixedFee).toFixed(4)} tTRUST</span>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t border-white/10 pt-1">
                        <span>Total</span>
                        <span className="font-mono">{(protocolCost + depositAmt + pctFee + fixedFee).toFixed(4)} tTRUST</span>
                      </div>
                    </div>
                  )
                })() : (
                  <p className="text-sm text-text-muted">~0.21 tTRUST (protocol + deposit + fee)</p>
                )}
              </div>`
  )

  writeFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/components/skills/RegisterSkillForm.tsx', c)
  console.log('RegisterSkillForm patched')
}
