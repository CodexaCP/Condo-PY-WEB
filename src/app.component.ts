import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from './app/auth/auth.service';
import { PushService } from './app/core/push.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule],
    template: `<router-outlet></router-outlet>`
})
export class AppComponent implements OnInit {
    private readonly auth = inject(AuthService);
    private readonly pushSvc = inject(PushService);

    ngOnInit(): void {
        if (this.auth.isAuthenticated()) {
            void this.pushSvc.init();
        }
    }
}
