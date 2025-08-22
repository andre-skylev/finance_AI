"use client"

import { Transaction } from "./columns"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface MobileTransactionCardProps {
  transaction: Transaction
  onEdit?: (t: Transaction) => void
  onDelete?: (t: Transaction) => void
  onView?: (t: Transaction) => void
}

export function MobileTransactionCard({ transaction, onEdit, onDelete, onView }: MobileTransactionCardProps) {
  const amount = new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: transaction.currency,
  }).format(transaction.amount)

  const date = new Date(transaction.transaction_date).toLocaleDateString("pt-PT")

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-medium text-sm">{transaction.description}</p>
          <p className="text-xs text-muted-foreground mt-1">{date}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(transaction.id)}
            >
              Copy transaction ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onView?.(transaction)}>View details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(transaction)}>Edit transaction</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(transaction)}>Delete transaction</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="flex justify-between items-center">
        <div className="flex gap-4 text-xs">
          {transaction.category && (
            <div>
              <span className="text-muted-foreground">Category: </span>
              <span className="font-medium">{transaction.category.name}</span>
            </div>
          )}
          {transaction.account && (
            <div>
              <span className="text-muted-foreground">Account: </span>
              <span className="font-medium">{transaction.account.name}</span>
            </div>
          )}
        </div>
        <div className={`font-semibold text-sm ${
          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
        }`}>
          {transaction.type === 'income' ? '+' : '-'}{amount}
        </div>
      </div>
    </div>
  )
}