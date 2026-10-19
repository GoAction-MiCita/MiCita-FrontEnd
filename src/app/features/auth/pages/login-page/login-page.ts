import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert/alert';
import { Icon } from '@shared/ui/icon/icon';

/** Login placeholder until HU-02. Shows the success message after a registration. */
@Component({
  selector: 'app-login-page',
  imports: [RouterLink, Alert, Icon],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LoginPage {
  /** `?registered=true` query param, set by RegisterPage after a 201. */
  readonly registered = input(false, { transform: booleanAttribute });
}
