// GraphQL queries for Intuition Protocol

export const AGENT_QUERIES = {
  GET_AGENTS: `
    query GetAgents(
      $first: Int = 20
      $skip: Int = 0
      $orderBy: String = "createdAt"
      $orderDirection: String = "desc"
      $where: AtomWhereInput
    ) {
      atoms(
        first: $first
        skip: $skip
        orderBy: $orderBy
        orderDirection: $orderDirection
        where: $where
      ) {
        id
        atomId
        label
        atomData
        createdAt
        vault {
          id
          totalShares
          currentSharePrice
          positionCount
        }
        createdBy {
          id
          address
        }
        triples {
          id
        }
        subjectTriples {
          id
          predicate {
            id
            label
          }
          object {
            id
            label
          }
          vault {
            totalShares
            positionCount
          }
          createdAt
        }
      }
      atomsConnection(where: $where) {
        totalCount
      }
    }
  `,

  GET_AGENT_BY_ID: `
    query GetAgentById($id: ID!) {
      atom(id: $id) {
        id
        atomId
        label
        atomData
        createdAt
        vault {
          id
          totalShares
          currentSharePrice
          positionCount
          positions {
            id
            user {
              id
              address
            }
            shares
          }
        }
        createdBy {
          id
          address
        }
        # Triples where this atom is the subject
        subjectTriples {
          id
          predicate {
            id
            label
          }
          object {
            id
            label
          }
          vault {
            totalShares
            positionCount
          }
          createdAt
        }
      }
    }
  `,

  GET_ATTESTATIONS: `
    query GetAttestations(
      $subjectId: ID
      $predicateId: ID
      $first: Int = 50
      $skip: Int = 0
      $orderBy: String = "createdAt"
      $orderDirection: String = "desc"
    ) {
      triples(
        first: $first
        skip: $skip
        orderBy: $orderBy
        orderDirection: $orderDirection
        where: {
          subject: $subjectId
          predicate: $predicateId
        }
      ) {
        id
        tripleId
        subject {
          id
          label
        }
        predicate {
          id
          label
        }
        object {
          id
          label
        }
        vault {
          id
          totalShares
          currentSharePrice
          positions {
            id
            user {
              id
              address
            }
            shares
            createdAt
          }
        }
        createdAt
        createdBy {
          id
          address
        }
      }
    }
  `,

  GET_TRUST_POSITIONS: `
    query GetTrustPositions($atomId: ID!) {
      atom(id: $atomId) {
        id
        vault {
          id
          totalShares
          currentSharePrice
          positionCount
          positions(orderBy: "shares", orderDirection: "desc") {
            id
            user {
              id
              address
            }
            shares
            createdAt
          }
        }
        # Get trust/distrust attestations
        subjectTriples(
          where: {
            predicate_in: ["trusts", "verified_by", "vouches_for", "distrusts", "reported_for_scam", "reported_for_spam", "reported_for_injection"]
          }
        ) {
          id
          predicate {
            id
            label
          }
          object {
            id
            label
          }
          vault {
            totalShares
            positions {
              shares
              user {
                address
              }
            }
          }
        }
      }
    }
  `,

  GET_ACTIVITY_FEED: `
    query GetActivityFeed($atomId: ID!, $first: Int = 20) {
      # Get all triples related to this atom
      triples(
        first: $first
        orderBy: "createdAt"
        orderDirection: "desc"
        where: {
          OR: [
            { subject: $atomId }
            { object: $atomId }
          ]
        }
      ) {
        id
        subject {
          id
          label
        }
        predicate {
          id
          label
        }
        object {
          id
          label
        }
        vault {
          totalShares
          positions(first: 1, orderBy: "createdAt", orderDirection: "desc") {
            user {
              address
            }
            shares
          }
        }
        createdAt
        createdBy {
          address
        }
      }
    }
  `,

  SEARCH_AGENTS: `
    query SearchAgents($searchTerm: String!, $first: Int = 10) {
      atoms(
        first: $first
        where: {
          OR: [
            { label_contains_nocase: $searchTerm }
            { atomData_contains_nocase: $searchTerm }
          ]
        }
      ) {
        id
        atomId
        label
        atomData
        vault {
          totalShares
          positionCount
        }
      }
    }
  `,
}

// Type definitions for GraphQL responses
export interface GraphQLAtom {
  id: string
  atomId: string
  label: string
  atomData: string
  createdAt: string
  vault: {
    id: string
    totalShares: string
    currentSharePrice: string
    positionCount: string
    positions?: {
      id: string
      user: {
        id: string
        address: string
      }
      shares: string
      createdAt?: string
    }[]
  }
  createdBy?: {
    id: string
    address?: string
  }
  subjectTriples?: GraphQLTriple[]
  triples?: {
    id: string
  }[]
}

export interface GraphQLTriple {
  id: string
  tripleId?: string
  subject: {
    id: string
    label: string
  }
  predicate: {
    id: string
    label: string
  }
  object: {
    id: string
    label: string
  }
  vault: {
    id?: string
    totalShares: string
    currentSharePrice?: string
    positionCount?: string
    positions?: {
      id?: string
      user: {
        id?: string
        address: string
      }
      shares: string
      createdAt?: string
    }[]
  }
  createdAt: string
  createdBy?: {
    id: string
    address: string
  }
}

export interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{
    message: string
    path?: string[]
  }>
}