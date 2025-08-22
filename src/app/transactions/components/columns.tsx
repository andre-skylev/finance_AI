"use client"

import { ColumnDef } from "@tanstack/react-table"
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

// This type is based on the existing page
export type Transaction = {
  id: string
  amount: number
  currency: string
  description: string
  transaction_date: string
  type: 'expense' | 'income'
  category: { name: string; color: string } | null
  account: { name: string; bank_name: string } | null
}

export type TransactionTableActions = {
  onEdit?: (t: Transaction) => void
  onDelete?: (t: Transaction) => void
  onView?: (t: Transaction) => void
}

export const buildColumns = (actions?: TransactionTableActions): ColumnDef<Transaction>[] => [
  {
    accessorKey: "description",
    header: "Description",
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"))
      const formatted = new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency: row.original.currency,
      }).format(amount)

      return <div className="text-right font-medium">{formatted}</div>
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => {
      return row.original.category?.name || "N/A"
    }
  },
  {
    accessorKey: "account",
    header: "Account",
    cell: ({ row }) => {
        return row.original.account?.name || "N/A"
    }
  },
  {
    accessorKey: "transaction_date",
    header: "Date",
    cell: ({ row }) => {
      return new Date(row.original.transaction_date).toLocaleDateString("pt-PT")
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const transaction = row.original

      return (
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
            <DropdownMenuItem onClick={() => actions?.onView?.(transaction)}>View details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions?.onEdit?.(transaction)}>Edit transaction</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => actions?.onDelete?.(transaction)}>Delete transaction</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]