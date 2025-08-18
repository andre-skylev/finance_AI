"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Upload, Brain, Zap } from "lucide-react"
import Link from "next/link"

export function QuickImport() {
  return (
    <div className="col-span-12 md:col-span-6 lg:col-span-4">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Importação IA</CardTitle>
                <CardDescription>
                  Processar extratos automaticamente
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-4">
            {/* Features */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-yellow-500" />
                <span className="text-gray-600">Auto-detecção</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-blue-500" />
                <span className="text-gray-600">Criação automática</span>
              </div>
            </div>

            {/* Upload Button */}
            <Button asChild className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
              <Link href="/import" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importar Documento
              </Link>
            </Button>

            {/* Supported formats */}
            <div className="text-xs text-gray-500 text-center">
              Extratos bancários • Faturas de cartão • PDF
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
