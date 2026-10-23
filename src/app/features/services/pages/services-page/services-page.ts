import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ServicesTable } from '@features/services/components/services-table/services-table';
import { ServicesStore } from '@features/services/data-access/services-store';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';

/** HU-08 · Consultar listado de servicios (private). Actions arrive with HU-09/10/11/14. */
@Component({
  selector: 'app-services-page',
  imports: [Alert, Button, Icon, ServicesTable],
  providers: [ServicesStore],
  templateUrl: './services-page.html',
  styleUrl: './services-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ServicesPage {
  protected readonly store = inject(ServicesStore);
}
