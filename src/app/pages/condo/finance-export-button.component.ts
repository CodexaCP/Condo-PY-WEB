import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { FinanceAccessService } from '../../api/finance-access.service';
import { FinanceApiService, FinanceExportKind } from '../../api/finance-api.service';
import { exportErrorMessage, exportFileName } from './finance-format';

export type FinanceExportParams = Record<string, string | number | boolean | null | undefined>;

// Botón «Exportar a Excel» de las pantallas de Finanzas: pide el archivo al backend (los mismos números que la pantalla, con el código
// del contador de cada rubro) y lo descarga. Los parámetros se piden al hacer clic (`params` es una función) para exportar lo que la
// pantalla muestra en ese momento (filtros, ejercicio, mes).
@Component({
  standalone: true,
  selector: 'app-finance-export-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Button],
  template: `
    <p-button type="button" [label]="label" icon="pi pi-file-excel" severity="secondary" [outlined]="true"
              [loading]="busy" [disabled]="disabled || !buildingId" [title]="disabled ? disabledHint : 'Descargar en Excel'" (onClick)="download()"></p-button>
  `
})
export class FinanceExportButtonComponent {
  private readonly api = inject(FinanceApiService);
  private readonly access = inject(FinanceAccessService);
  private readonly msg = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) kind!: FinanceExportKind;
  @Input() buildingId = '';
  @Input() params: () => FinanceExportParams = () => ({});
  // Parte del nombre del archivo: finanzas-<fileLabel>-<edificio>-<period>.xlsx
  @Input() fileLabel = 'reporte';
  @Input() period = '';
  @Input() label = 'Exportar a Excel';
  @Input() disabled = false;
  @Input() disabledHint = '';

  busy = false;

  download(): void {
    if (this.busy || !this.buildingId) return;

    const query: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(this.params())) {
      if (value !== null && value !== undefined && value !== '') query[key] = value;
    }

    const building = this.access.buildings().find(b => b.buildingId === this.buildingId)?.buildingName ?? '';
    const fileName = exportFileName(this.fileLabel, building, this.period || 'actual');

    this.busy = true;
    this.api.downloadExport(this.kind, this.buildingId, query).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        this.busy = false;
        this.msg.add({ severity: 'success', summary: 'Excel generado', detail: fileName, life: 4000 });
        this.cdr.markForCheck();
      },
      error: async err => {
        const detail = await exportErrorMessage(err, 'No se pudo generar el Excel.');
        this.busy = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail, life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }
}
