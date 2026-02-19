'use client'

import { useState } from 'react'
import { useIntuition, useAtom, useSearchAtoms, useUserPositions, useCreatorAtoms } from '@/hooks/useIntuition'
import { parseEther } from 'viem'
import { AGENTS_TO_REGISTER } from '@/data/realAgents'

interface CreatedAtom {
  id: string           // termId (bytes32)
  name: string         // nazwa którą wpisał user
  txHash: string       // hash transakcji
  timestamp: Date      // kiedy utworzono
  atomWallet?: string  // adres atom wallet
  uri?: string         // atom URI
}

export default function TestIntuitionPage() {
  const [testAtomId, setTestAtomId] = useState<`0x${string}`>()
  const [searchQuery, setSearchQuery] = useState('')
  const [testText, setTestText] = useState('Hello Intuition')
  const [agentName, setAgentName] = useState('Test Agent')
  const [agentDescription, setAgentDescription] = useState('A test agent on Intuition')
  const [stakeAmount, setStakeAmount] = useState('0.01')

  // Created Atoms tracking
  const [createdAtoms, setCreatedAtoms] = useState<CreatedAtom[]>([])
  const [showAtomsModal, setShowAtomsModal] = useState(false)

  // Trust/Distrust voting
  const [trustAmount, setTrustAmount] = useState('0.05')
  const [voteStatus, setVoteStatus] = useState<string | null>(null)
  const [isVoting, setIsVoting] = useState(false)

  // Real agents registration tracking
  const [registeredAgents, setRegisteredAgents] = useState<Record<string, string>>({})
  // key = agent name, value = atom termId

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingVote, setPendingVote] = useState<{
    type: 'trust' | 'distrust'
    atomId: string
    atomName: string
    amount: string
  } | null>(null)

  const intuition = useIntuition()
  const atomQuery = useAtom(testAtomId)
  const searchQuery_ = useSearchAtoms(searchQuery, searchQuery.length > 0)
  const positionsQuery = useUserPositions(intuition.address)
  const creatorAtomsQuery = useCreatorAtoms(intuition.address)

  // Helper - get atom name by ID
  const getAtomName = (id: string) => {
    const found = creatorAtomsQuery.data?.find((a: any) => a.term_id === id)
    return found ? found.label : 'Unknown Agent'
  }

  // Execute vote after confirmation
  const executeVote = async () => {
    if (!pendingVote || !intuition.walletClient || !intuition.publicClient) return
    setShowConfirmModal(false)
    setIsVoting(true)
    setVoteStatus(null)
    try {
      const { createWriteConfig, trustAgent, distrustAgent, parseStakeAmount } = await import('@/lib/intuition')
      const cfg = createWriteConfig(intuition.walletClient, intuition.publicClient)

      let result
      if (pendingVote.type === 'trust') {
        result = await trustAgent(cfg, pendingVote.atomId as `0x${string}`, parseStakeAmount(pendingVote.amount))
        setVoteStatus(`✅ TRUST signal sent! TX: ${result.transactionHash}`)
      } else {
        result = await distrustAgent(cfg, pendingVote.atomId as `0x${string}`, 1n)
        setVoteStatus(`✅ DISTRUST signal sent! TX: ${result.transactionHash}`)
      }
    } catch (e: any) {
      setVoteStatus(`❌ Error: ${e.message}`)
    } finally {
      setIsVoting(false)
      setPendingVote(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-secondary to-background-primary p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            🧪 Intuition Protocol Test Lab
          </h1>
          <p className="text-text-secondary">
            Test Intuition SDK integration on testnet
          </p>
        </div>

        {/* Connection Status */}
        <div className="bg-background-secondary rounded-lg p-6 border border-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">📡 Connection Status</h2>
            <button
              onClick={() => setShowAtomsModal(true)}
              disabled={!intuition.isConnected}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors"
            >
              📦 My Atoms ({creatorAtomsQuery.data?.length || 0})
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  intuition.isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span>
                {intuition.isConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            {intuition.address && (
              <p className="text-sm text-text-muted font-mono">
                {intuition.address}
              </p>
            )}
          </div>

          {!intuition.isConnected && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded">
              <p className="text-sm">
                ⚠️ Please connect your wallet to Intuition Testnet (Chain ID: 13579)
              </p>
              <p className="text-xs text-text-muted mt-2">
                Network: https://testnet.rpc.intuition.systems/http
              </p>
            </div>
          )}
        </div>

        {/* Section 0: Register Real AI Agents */}
        <div className="bg-background-secondary rounded-lg p-6 border border-border">
          <h2 className="text-xl font-bold mb-2">0️⃣ Register Real AI Agents on Testnet</h2>
          <p className="text-sm text-text-secondary mb-4">
            Register well-known AI agents as Atoms on Intuition testnet.
            Each registration costs ~0.001 tTRUST in gas.
            You have ~0.6 tTRUST — enough for all 8 agents.
          </p>

          <div className="grid grid-cols-1 gap-3 mb-4">
            {AGENTS_TO_REGISTER.map((agent) => {
              const isRegistered = !!registeredAgents[agent.name]

              return (
                <div key={agent.name} className="flex items-center justify-between p-3 bg-background-tertiary rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{agent.emoji}</span>
                    <div>
                      <p className="font-semibold text-white text-sm">{agent.name}</p>
                      <p className="text-xs text-text-muted">{agent.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isRegistered ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400 font-mono">
                          ✅ {registeredAgents[agent.name].slice(0,10)}...
                        </span>
                        <button
                          onClick={() => {
                            setTestAtomId(registeredAgents[agent.name] as `0x${string}`)
                            document.getElementById('trust-section')?.scrollIntoView({ behavior: 'smooth' })
                          }}
                          className="px-2 py-1 bg-green-600/20 border border-green-600/30 rounded text-xs text-green-400"
                        >
                          Trust/Distrust
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          if (!intuition.walletClient || !intuition.publicClient) return
                          try {
                            const { createWriteConfig, createAgentAtom } = await import('@/lib/intuition')
                            const cfg = createWriteConfig(intuition.walletClient, intuition.publicClient)
                            const result = await createAgentAtom(cfg, {
                              name: agent.name,
                              description: agent.description,
                              category: agent.category,
                              website: agent.website,
                              tags: agent.tags,
                            })
                            setRegisteredAgents(prev => ({
                              ...prev,
                              [agent.name]: result.state.termId
                            }))
                          } catch (e: any) {
                            alert(`Error: ${e.message}`)
                          }
                        }}
                        disabled={!intuition.isConnected}
                        className="px-3 py-1.5 bg-primary hover:bg-primary-hover disabled:bg-border disabled:cursor-not-allowed rounded text-xs text-white font-semibold transition-colors"
                      >
                        + Register
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-text-secondary">
            💡 After registering agents, scroll to section 6️⃣ Trust/Distrust to vote on them.
            Registered atom IDs are saved in this session.
          </div>
        </div>

        {/* Test 1: Create Simple Atom */}
        <div className="bg-background-secondary rounded-lg p-6 border border-border">
          <h2 className="text-xl font-bold mb-4">1️⃣ Create Simple Text Atom</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Atom Text:
              </label>
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg text-white placeholder:text-text-muted"
                placeholder="Enter text for atom..."
              />
            </div>

            <button
              onClick={async () => {
                try {
                  const result = await intuition.createSimpleAtomAsync({
                    text: testText,
                    deposit: parseEther('0.001'),
                  })

                  // Refetch creator atoms to show new atom
                  await creatorAtomsQuery.refetch()
                  setShowAtomsModal(true) // Show modal
                } catch (error) {
                  console.error('Failed to create atom:', error)
                }
              }}
              disabled={!intuition.isConnected || intuition.isCreatingSimple}
              className="px-6 py-3 bg-primary hover:bg-primary-hover disabled:bg-border disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {intuition.isCreatingSimple
                ? 'Creating Atom...'
                : 'Create Simple Atom'}
            </button>

            {intuition.error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded text-sm">
                <p className="font-semibold text-red-400">Error:</p>
                <p className="text-red-300">{intuition.error.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Test 2: Create Agent Atom */}
        <div className="bg-background-secondary rounded-lg p-6 border border-border">
          <h2 className="text-xl font-bold mb-4">2️⃣ Create Agent Atom (with Metadata)</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Agent Name:
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg text-white placeholder:text-text-muted"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description:
              </label>
              <textarea
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg text-white placeholder:text-text-muted"
                rows={3}
              />
            </div>

            <button
              onClick={async () => {
                try {
                  const result = await intuition.createAgentAsync({
                    metadata: {
                      name: agentName,
                      description: agentDescription,
                      category: 'coding',
                      tags: ['test', 'demo'],
                    },
                    deposit: parseEther('0.001'),
                  })

                  // Refetch creator atoms to show new atom
                  await creatorAtomsQuery.refetch()
                  setShowAtomsModal(true) // Show modal
                } catch (error) {
                  console.error('Failed to create agent:', error)
                }
              }}
              disabled={!intuition.isConnected || intuition.isCreatingAgent}
              className="px-6 py-3 bg-accent-cyan hover:bg-accent-cyan/80 disabled:bg-border disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {intuition.isCreatingAgent
                ? 'Creating Agent...'
                : 'Create Agent Atom'}
            </button>

            {intuition.createAgentError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded text-sm">
                <p className="font-semibold text-red-400">Error:</p>
                <p className="text-red-300">{intuition.createAgentError.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stakes Dashboard */}
        <div className="bg-background-secondary rounded-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">📊 My Stakes Dashboard</h2>
            <button
              onClick={() => positionsQuery.refetch()}
              className="px-3 py-1 bg-background-tertiary hover:bg-border rounded text-xs text-white transition-colors"
            >
              🔄 Refresh
            </button>
          </div>

          {!intuition.isConnected && (
            <p className="text-text-muted text-sm">Connect wallet to see your stakes.</p>
          )}

          {intuition.isConnected && positionsQuery.isLoading && (
            <div className="flex items-center gap-2 text-text-muted">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
              <span className="text-sm">Loading your positions...</span>
            </div>
          )}

          {intuition.isConnected && positionsQuery.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-300">
              Error loading positions. GraphQL API may be unavailable.
            </div>
          )}

          {intuition.isConnected && positionsQuery.data && (
            <>
              {positionsQuery.data.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">🏦</p>
                  <p className="text-text-secondary">No stakes yet.</p>
                  <p className="text-text-muted text-sm mt-1">
                    Trust an agent above to see your positions here.
                  </p>
                </div>
              ) : (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-background-tertiary rounded-lg p-3 border border-border">
                      <p className="text-text-secondary text-xs mb-1">Total Positions</p>
                      <p className="text-2xl font-bold text-white">{positionsQuery.data.length}</p>
                    </div>
                    <div className="bg-background-tertiary rounded-lg p-3 border border-border">
                      <p className="text-text-secondary text-xs mb-1">Total Shares</p>
                      <p className="text-2xl font-bold text-accent-cyan">
                        {positionsQuery.data.reduce((sum: number, p: any) =>
                          sum + Number(p.shares || 0), 0
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Positions List */}
                  <div className="space-y-3">
                    {positionsQuery.data.map((position: any, i: number) => {
                      const atom = position.term?.atom
                      const sharesNum = Number(position.shares || 0)
                      const totalShares = Number(position.vault?.total_shares || 1)
                      const ownershipPct = ((sharesNum / totalShares) * 100).toFixed(1)

                      return (
                        <div key={i} className="bg-background-tertiary rounded-lg p-4 border border-border">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{atom?.emoji || '🤖'}</span>
                              <div>
                                <p className="font-semibold text-white text-sm">
                                  {atom?.label || 'Unknown Agent'}
                                </p>
                                <p className="text-xs text-text-muted">
                                  {atom?.type || 'atom'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-accent-cyan font-bold text-sm">
                                {sharesNum.toLocaleString()} shares
                              </p>
                              <p className="text-xs text-text-muted">{ownershipPct}% of vault</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 bg-background/50 rounded-full h-1.5">
                              <div
                                className="bg-accent-cyan h-1.5 rounded-full"
                                style={{ width: `${Math.min(parseFloat(ownershipPct), 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-text-muted">
                              {new Date(position.updated_at).toLocaleDateString()}
                            </span>
                          </div>

                          <code className="text-xs text-text-muted mt-2 block break-all">
                            {position.term_id?.slice(0, 16)}...
                          </code>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Test 3: Search Atoms */}
        <div className="bg-background-secondary rounded-lg p-6 border border-border">
          <h2 className="text-xl font-bold mb-4">3️⃣ Search Atoms</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Search Query:
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg text-white placeholder:text-text-muted"
                placeholder="Enter search term..."
              />
            </div>

            {searchQuery_.isLoading && (
              <p className="text-text-muted">Searching...</p>
            )}

            {searchQuery_.error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded text-sm">
                <p className="font-semibold text-red-400">Search Error:</p>
                <p className="text-red-300">{searchQuery_.error.message}</p>
              </div>
            )}

            {searchQuery_.data && Array.isArray(searchQuery_.data) && (
              <div className="space-y-2">
                <p className="font-semibold text-sm text-text-secondary">
                  Found {searchQuery_.data.length} atoms:
                </p>
                {searchQuery_.data.length === 0 && (
                  <p className="text-text-muted text-sm">No atoms found. Try a different search term.</p>
                )}
                {searchQuery_.data.map((atom: any, i: number) => (
                  <div key={i} className="p-3 bg-background-tertiary rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{atom.emoji || '🤖'}</span>
                      <span className="font-semibold text-white">{atom.label}</span>
                      <span className="text-xs text-text-muted ml-auto">{atom.type}</span>
                    </div>
                    <code className="text-xs text-accent-cyan break-all">{atom.term_id}</code>
                    <div className="flex gap-4 mt-2 text-xs text-text-secondary">
                      <span>📊 {atom.positions_aggregate?.aggregate?.count || 0} stakers</span>
                      <span>👤 by {atom.creator?.label || atom.creator_id?.slice(0, 8)}</span>
                    </div>
                    <button
                      onClick={() => {
                        setTestAtomId(atom.term_id as `0x${string}`)
                        document.getElementById('stake-section')?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      className="mt-2 px-3 py-1 bg-green-600/20 hover:bg-green-600/40 border border-green-600/30 rounded text-xs text-green-400 font-semibold transition-colors"
                    >
                      Use for Trust/Distrust →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Test 4: Get Atom Details */}
        <div id="details-section" className="bg-background-secondary rounded-lg p-6 border border-border">
          <h2 className="text-xl font-bold mb-4">4️⃣ Get Atom Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Atom ID (0x...):
              </label>
              <input
                type="text"
                value={testAtomId || ''}
                onChange={(e) =>
                  setTestAtomId(e.target.value as `0x${string}`)
                }
                className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg font-mono text-sm text-white placeholder:text-text-muted"
                placeholder="0x..."
              />
            </div>

            {atomQuery.isLoading && (
              <p className="text-text-muted">Loading atom...</p>
            )}

            {atomQuery.error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded text-sm">
                <p className="font-semibold text-red-400">Error:</p>
                <p className="text-red-300">{atomQuery.error.message}</p>
              </div>
            )}

            {atomQuery.data && (
              <div className="p-4 bg-background-tertiary rounded-lg border border-border">
                <p className="font-semibold mb-2">Atom Data:</p>
                <pre className="text-xs overflow-auto max-h-64">
                  {JSON.stringify(atomQuery.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Test 5: Stake (Deposit) */}
        <div id="stake-section" className="bg-background-secondary rounded-lg p-6 border border-border">
          <h2 className="text-xl font-bold mb-4">5️⃣ Stake on Atom/Vault</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Vault ID (0x...):
              </label>
              <input
                type="text"
                value={testAtomId || ''}
                onChange={(e) =>
                  setTestAtomId(e.target.value as `0x${string}`)
                }
                className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg font-mono text-sm text-white placeholder:text-text-muted"
                placeholder="0x..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Amount (tTRUST):
              </label>
              <input
                type="text"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg text-white placeholder:text-text-muted"
                placeholder="0.01"
              />
            </div>

            <button
              onClick={() => {
                if (!testAtomId) return
                intuition.deposit({
                  vaultId: testAtomId,
                  amount: parseEther(stakeAmount),
                })
              }}
              disabled={
                !intuition.isConnected ||
                !testAtomId ||
                intuition.isDepositing
              }
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-border disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {intuition.isDepositing ? 'Staking...' : 'Stake (Deposit)'}
            </button>

            {intuition.depositError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded text-sm">
                <p className="font-semibold text-red-400">Error:</p>
                <p className="text-red-300">{intuition.depositError.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Test 6: Trust / Distrust */}
        <div id="trust-section" className="bg-background-secondary rounded-lg p-6 border border-border">
          <h2 className="text-xl font-bold mb-2">6️⃣ Trust / Distrust an Agent</h2>
          <p className="text-sm text-text-secondary mb-4">
            <span className="text-green-400 font-semibold">👍 TRUST</span> = deposit tTRUST into agent vault → raises Trust Score<br/>
            <span className="text-red-400 font-semibold">👎 DISTRUST</span> = redeem shares from agent vault → lowers Trust Score
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Agent Atom ID (0x...):
              </label>
              <input
                type="text"
                value={testAtomId || ''}
                onChange={(e) => setTestAtomId(e.target.value as `0x${string}`)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg font-mono text-sm text-white placeholder:text-text-muted"
                placeholder="Paste atom ID here or use 'Use for Stake' button from My Atoms modal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Amount to stake (tTRUST):
              </label>
              <input
                type="text"
                value={trustAmount}
                onChange={(e) => setTrustAmount(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg text-white placeholder:text-text-muted"
                placeholder="0.05"
              />
              <p className="text-xs text-text-muted mt-1">
                Recommended: 0.05+ tTRUST. You have 0.6 tTRUST on testnet.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  if (!testAtomId) return
                  setPendingVote({
                    type: 'trust',
                    atomId: testAtomId,
                    atomName: getAtomName(testAtomId),
                    amount: trustAmount,
                  })
                  setShowConfirmModal(true)
                }}
                disabled={!intuition.isConnected || !testAtomId || isVoting}
                className="py-4 bg-green-600 hover:bg-green-500 disabled:bg-border disabled:cursor-not-allowed rounded-lg font-bold text-white transition-all text-xl flex items-center justify-center gap-2"
              >
                {isVoting ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>👍 <span className="text-base">TRUST</span></>
                )}
              </button>

              <button
                onClick={() => {
                  if (!testAtomId) return
                  setPendingVote({
                    type: 'distrust',
                    atomId: testAtomId,
                    atomName: getAtomName(testAtomId),
                    amount: trustAmount,
                  })
                  setShowConfirmModal(true)
                }}
                disabled={!intuition.isConnected || !testAtomId || isVoting}
                className="py-4 bg-red-600 hover:bg-red-500 disabled:bg-border disabled:cursor-not-allowed rounded-lg font-bold text-white transition-all text-xl flex items-center justify-center gap-2"
              >
                {isVoting ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>👎 <span className="text-base">DISTRUST</span></>
                )}
              </button>
            </div>

            {voteStatus && (
              <div className={`p-4 rounded-lg text-sm font-mono ${
                voteStatus.startsWith('✅')
                  ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}>
                {voteStatus}
              </div>
            )}

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-text-secondary">
              💡 <strong>How it works:</strong> Trusting an agent deposits tTRUST into their on-chain vault.
              More deposits = higher Trust Score. Distrust redeems shares = negative signal.
              All actions are transparent and verifiable on-chain.
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
          <h3 className="font-bold mb-2">ℹ️ Testing Instructions</h3>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>Connect wallet to Intuition Testnet (Chain ID: 13579)</li>
            <li>Get testnet tTRUST from faucet: https://testnet.hub.intuition.systems/</li>
            <li>Try creating a simple atom (test 1)</li>
            <li>Try creating an agent with metadata (test 2)</li>
            <li>Copy the atom ID from transaction and test fetching (test 4)</li>
            <li>Try staking on that atom (test 5)</li>
            <li>Search for created atoms (test 3)</li>
          </ol>
        </div>

        {/* Loading State */}
        {intuition.isLoading && (
          <div className="fixed bottom-4 right-4 bg-primary text-white px-6 py-3 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              <span>Transaction pending...</span>
            </div>
          </div>
        )}

        {/* Stake Confirmation Modal */}
        {showConfirmModal && pendingVote && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background-secondary border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl">

              {/* Header */}
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">
                  {pendingVote.type === 'trust' ? '👍' : '👎'}
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Confirm {pendingVote.type === 'trust' ? 'TRUST' : 'DISTRUST'}
                </h2>
                <p className="text-text-secondary text-sm mt-1">
                  Review your signal before confirming
                </p>
              </div>

              {/* Summary Card */}
              <div className="bg-background-tertiary rounded-xl p-4 space-y-3 mb-6 border border-border">

                <div className="flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Action</span>
                  <span className={`font-bold text-sm px-3 py-1 rounded-full ${
                    pendingVote.type === 'trust'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {pendingVote.type === 'trust' ? '👍 TRUST' : '👎 DISTRUST'}
                  </span>
                </div>

                <div className="border-t border-border/50 pt-3">
                  <span className="text-text-secondary text-sm block mb-1">Agent</span>
                  <span className="text-white font-semibold">{pendingVote.atomName}</span>
                  <code className="text-xs text-text-muted block mt-1 break-all">
                    {pendingVote.atomId.slice(0, 20)}...{pendingVote.atomId.slice(-8)}
                  </code>
                </div>

                {pendingVote.type === 'trust' && (
                  <div className="border-t border-border/50 pt-3 flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Amount to stake</span>
                    <span className="text-accent-cyan font-bold text-lg">
                      {pendingVote.amount} tTRUST
                    </span>
                  </div>
                )}

                {pendingVote.type === 'distrust' && (
                  <div className="border-t border-border/50 pt-3">
                    <span className="text-text-secondary text-sm block">Effect</span>
                    <span className="text-red-400 text-sm">Redeems 1 share from agent vault → negative signal</span>
                  </div>
                )}

                <div className="border-t border-border/50 pt-3">
                  <span className="text-text-secondary text-sm block mb-1">Network</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-white text-sm">Intuition Testnet (Chain ID: 13579)</span>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-6 text-xs text-yellow-300">
                ⚠️ This will submit an on-chain transaction.
                Gas fees apply. Action is recorded permanently on the blockchain.
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmModal(false)
                    setPendingVote(null)
                  }}
                  className="flex-1 py-3 bg-background-tertiary hover:bg-border rounded-xl font-semibold text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeVote}
                  className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${
                    pendingVote.type === 'trust'
                      ? 'bg-green-600 hover:bg-green-500'
                      : 'bg-red-600 hover:bg-red-500'
                  }`}
                >
                  {pendingVote.type === 'trust' ? '👍 Confirm TRUST' : '👎 Confirm DISTRUST'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* My Atoms Modal */}
        {showAtomsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background-secondary border border-border rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">

              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">🎉 My Created Atoms</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => creatorAtomsQuery.refetch()}
                    className="px-3 py-1 bg-background-tertiary hover:bg-border rounded text-xs text-white transition-colors"
                  >
                    🔄 Refresh
                  </button>
                  <button
                    onClick={() => setShowAtomsModal(false)}
                    className="text-text-muted hover:text-white text-2xl leading-none"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {creatorAtomsQuery.isLoading && (
                <div className="flex items-center gap-2 text-text-muted">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                  <span className="text-sm">Loading your atoms...</span>
                </div>
              )}

              {creatorAtomsQuery.error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-300">
                  Error loading atoms: {creatorAtomsQuery.error.message}
                </div>
              )}

              {creatorAtomsQuery.data && creatorAtomsQuery.data.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">🧪</p>
                  <p className="text-text-secondary">No atoms created yet.</p>
                  <p className="text-text-muted text-sm mt-1">
                    Create your first atom above!
                  </p>
                </div>
              ) : creatorAtomsQuery.data && (
                <div className="space-y-4">
                  {creatorAtomsQuery.data.map((atom: any, index: number) => {
                    const totalStakers = atom.positions_aggregate?.aggregate?.count || 0
                    const totalShares = atom.positions_aggregate?.aggregate?.sum?.shares || 0

                    return (
                    <div key={index} className="bg-background-tertiary rounded-lg p-4 border border-border">

                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{atom.emoji || '🤖'}</span>
                          <div>
                            <h3 className="text-lg font-semibold text-white">{atom.label}</h3>
                            <span className="text-xs text-text-muted">{atom.type}</span>
                          </div>
                        </div>
                        <span className="text-xs text-text-muted">
                          {new Date(atom.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-text-secondary">Atom ID (termId): </span>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-accent-cyan text-xs break-all bg-background/50 px-2 py-1 rounded flex-1">
                              {atom.term_id}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(atom.term_id)
                                alert('Atom ID copied!')
                              }}
                              className="text-text-muted hover:text-white text-lg"
                              title="Copy Atom ID"
                            >
                              📋
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="bg-background/50 rounded-lg p-2">
                            <p className="text-text-secondary text-xs">Stakers</p>
                            <p className="text-accent-cyan font-bold text-lg">{totalStakers}</p>
                          </div>
                          <div className="bg-background/50 rounded-lg p-2">
                            <p className="text-text-secondary text-xs">Total Shares</p>
                            <p className="text-accent-purple font-bold text-lg">
                              {Number(totalShares).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div>
                          <span className="text-text-secondary">Creator: </span>
                          <code className="text-text-muted text-xs break-all">
                            {atom.creator_id?.slice(0, 10)}...{atom.creator_id?.slice(-8)}
                          </code>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setTestAtomId(atom.term_id as `0x${string}`)
                            setShowAtomsModal(false)
                            document.getElementById('stake-section')?.scrollIntoView({ behavior: 'smooth' })
                          }}
                          className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm text-white font-semibold transition-colors"
                        >
                          💰 Use for Stake
                        </button>
                        <button
                          onClick={() => {
                            setTestAtomId(atom.term_id as `0x${string}`)
                            setShowAtomsModal(false)
                            document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' })
                          }}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white font-semibold transition-colors"
                        >
                          📄 Get Details
                        </button>
                        <a
                          href={`https://testnet.portal.intuition.systems/app/explore/atoms/${atom.term_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm text-white font-semibold transition-colors"
                        >
                          🔍 View on Portal
                        </a>
                      </div>

                    </div>
                  )})}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-border">
                <button
                  onClick={() => setShowAtomsModal(false)}
                  className="w-full py-2 bg-background-tertiary hover:bg-border rounded text-white font-semibold transition-colors"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
