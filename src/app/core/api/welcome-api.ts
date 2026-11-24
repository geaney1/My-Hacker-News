import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WelcomeContent } from '../../models/welcome-content';

@Injectable({ providedIn: 'root' })
export class WelcomeApi {
  private readonly http = inject(HttpClient);

  getWelcome() {
    return firstValueFrom(this.http.get<WelcomeContent>('/api/welcome'));
  }
}
