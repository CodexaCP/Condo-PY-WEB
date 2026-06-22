export type RoleOption = {
  value: string;
  label: string;
};

export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'SuperAdmin':
      return 'Superadministrador';
    case 'CompanyAdmin':
      return 'Administrador de empresa';
    case 'CompanyOperator':
      return 'Operador de empresa';
    case 'BuildingManager':
      return 'Encargado de edificio';
    case 'Resident':
      return 'Residente';
    case 'Porter':
      return 'Porteria';
    default:
      return role ?? '';
  }
}

export function roleOptions(isSuperAdmin: boolean): RoleOption[] {
  return isSuperAdmin
    ? [
        { value: 'CompanyAdmin', label: roleLabel('CompanyAdmin') },
        { value: 'CompanyOperator', label: roleLabel('CompanyOperator') },
        { value: 'BuildingManager', label: roleLabel('BuildingManager') }
      ]
    : [
        { value: 'CompanyOperator', label: roleLabel('CompanyOperator') },
        { value: 'BuildingManager', label: roleLabel('BuildingManager') }
      ];
}
