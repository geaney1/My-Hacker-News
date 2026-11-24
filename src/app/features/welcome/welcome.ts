import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WelcomeApi } from '../../core/api/welcome-api';

@Component({
  selector: 'app-welcome',
  imports: [RouterLink],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Welcome {
  private readonly welcomeApi = inject(WelcomeApi);

  protected readonly welcome = resource({ loader: () => this.welcomeApi.getWelcome() });
}
