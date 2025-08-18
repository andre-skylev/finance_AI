"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MoreVertical, Trash2, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type Goal = {
  id: string
  name: string
  description: string | null
  target_amount: number
  current_amount: number
  currency: string
  target_date: string | null
  is_completed: boolean
}

interface GoalCardProps {
  goal: Goal;
  onDelete: (id: string) => void;
  onEdit: (goal: Goal) => void;
}

export function GoalCard({ goal, onDelete, onEdit }: GoalCardProps) {
  const progress = (goal.current_amount / goal.target_amount) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{goal.name}</CardTitle>
            {goal.description && <CardDescription>{goal.description}</CardDescription>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(goal)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(goal.id)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="text-sm font-medium">{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress} />
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">
            {new Intl.NumberFormat("pt-PT", { style: "currency", currency: goal.currency }).format(goal.current_amount)}
          </p>
          <p className="text-sm text-muted-foreground">
            of {new Intl.NumberFormat("pt-PT", { style: "currency", currency: goal.currency }).format(goal.target_amount)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
