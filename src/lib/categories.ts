export const DEFAULT_CATEGORY_KEY_BY_PT_NAME: Record<string, string> = {
  // Expenses
  'Alimentação': 'categories.defaults.alimentacao',
  'Supermercado': 'categories.defaults.supermercado',
  'Transporte': 'categories.defaults.transporte',
  'Habitação': 'categories.defaults.habitacao',
  'Serviços Públicos': 'categories.defaults.servicosPublicos',
  'Saúde': 'categories.defaults.saude',
  'Educação': 'categories.defaults.educacao',
  'Lazer': 'categories.defaults.lazer',
  'Viagens': 'categories.defaults.viagens',
  'Compras': 'categories.defaults.compras',
  'Assinaturas': 'categories.defaults.assinaturas',
  'Impostos': 'categories.defaults.impostos',
  'Taxas': 'categories.defaults.taxas',
  'Seguros': 'categories.defaults.seguros',
  'Pets': 'categories.defaults.pets',
  'Presentes': 'categories.defaults.presentes',
  'Doações': 'categories.defaults.doacoes',
  'Investimentos': 'categories.defaults.investimentos',
  'Outros': 'categories.defaults.outros',
  // Income
  'Salário': 'categories.defaults.salario',
  'Freelance': 'categories.defaults.freelance',
  'Reembolsos': 'categories.defaults.reembolsos',
};

export function translateCategoryName(name: string, isDefault: boolean, t: (k: string) => string): string {
  if (!isDefault) return name;
  const key = DEFAULT_CATEGORY_KEY_BY_PT_NAME[name];
  return key ? t(key) : name;
}
