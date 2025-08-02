import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-downloads',
  imports: [],
  templateUrl: './downloads.html',
  styleUrl: './downloads.css'
})
export class Downloads {
 constructor(private router: Router) {}

  goBackToHome(): void {
    this.router.navigate(['/']);
  }


   downloadPdf(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
