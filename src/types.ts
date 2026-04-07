export interface WalletItem {
  id: number
  name: string
  type: string
  balance: number
}

export interface VoiceResult {
  type: string
  amount: number | null
  category: string
  wallet_id: number | null
  wallet_name: string
  description: string
  confidence: string
}

export interface Transaction {
  id: number
  type: string
  amount: number
  category: string
  description: string | null
  wallet_name: string
  date: string
}
