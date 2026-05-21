const MCP_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
}

function redirectToMcp(request: Request) {
  const url = new URL(request.url)
  url.pathname = '/api/mcp/mcp'
  return new Response(null, {
    status: 307,
    headers: {
      Location: url.toString(),
      ...MCP_CORS_HEADERS,
    },
  })
}

export function GET(request: Request) {
  return redirectToMcp(request)
}

export function POST(request: Request) {
  return redirectToMcp(request)
}

export function OPTIONS() {
  return new Response(null, { headers: MCP_CORS_HEADERS })
}
