'use client'

import { useState } from 'react'
import { useIntuition, useAtom, useSearchAtoms } from '@/hooks/useIntuition'
import { parseEther } from 'viem'

export default function TestIntuitionPage() {
  const [testAtomId, setTestAtomId] = useState<`0x${string}`>()
  const [searchQuery, setSearchQuery] = useState('')
  const [testText, setTestText] = useState('Hello Intuition')
  const [agentName, setAgentName] = useState('Test Agent')
  const [agentDescription, setAgentDescription] = useState('A test agent on Intuition')
  const [stakeAmount, setStakeAmount] = useState('0.01')

  const intuition = useIntuition()
  const atomQuery = useAtom(testAtomId)
  const searchQuery_ = useSearchAtoms(searchQuery, searchQuery.length > 0)

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
        <div className="bg-surface rounded-lg p-6 border border-border">
          <h2 className="text-xl font-bold mb-4">📡 Connection Status</h2>
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

        {/* Test 1: Create Simple Atom */}
        <div className="bg-surface rounded-lg p-6 border border-border">
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
                className="w-full px-4 py-2 bg-background-primary border border-border rounded-lg"
                placeholder="Enter text for atom..."
              />
            </div>

            <button
              onClick={() =>
                intuition.createSimpleAtom({
                  text: testText,
                  deposit: parseEther('0.001'),
                })
              }
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
        <div className="bg-surface rounded-lg p-6 border border-border">
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
                className="w-full px-4 py-2 bg-background-primary border border-border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description:
              </label>
              <textarea
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                className="w-full px-4 py-2 bg-background-primary border border-border rounded-lg"
                rows={3}
              />
            </div>

            <button
              onClick={() =>
                intuition.createAgent({
                  metadata: {
                    name: agentName,
                    description: agentDescription,
                    category: 'coding',
                    tags: ['test', 'demo'],
                  },
                  deposit: parseEther('0.001'),
                })
              }
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

        {/* Test 3: Search Atoms */}
        <div className="bg-surface rounded-lg p-6 border border-border">
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
                className="w-full px-4 py-2 bg-background-primary border border-border rounded-lg"
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

            {searchQuery_.data && (
              <div className="p-4 bg-background-primary rounded-lg border border-border">
                <p className="font-semibold mb-2">Results:</p>
                <pre className="text-xs overflow-auto max-h-64">
                  {JSON.stringify(searchQuery_.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Test 4: Get Atom Details */}
        <div className="bg-surface rounded-lg p-6 border border-border">
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
                className="w-full px-4 py-2 bg-background-primary border border-border rounded-lg font-mono text-sm"
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
              <div className="p-4 bg-background-primary rounded-lg border border-border">
                <p className="font-semibold mb-2">Atom Data:</p>
                <pre className="text-xs overflow-auto max-h-64">
                  {JSON.stringify(atomQuery.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Test 5: Stake (Deposit) */}
        <div className="bg-surface rounded-lg p-6 border border-border">
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
                className="w-full px-4 py-2 bg-background-primary border border-border rounded-lg font-mono text-sm"
                placeholder="0x..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Amount (ETH):
              </label>
              <input
                type="text"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full px-4 py-2 bg-background-primary border border-border rounded-lg"
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

        {/* Info Section */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
          <h3 className="font-bold mb-2">ℹ️ Testing Instructions</h3>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>Connect wallet to Intuition Testnet (Chain ID: 13579)</li>
            <li>Get testnet ETH from faucet: https://testnet.hub.intuition.systems/</li>
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
      </div>
    </div>
  )
}
