import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-welcomepage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './welcomepage.html',
  styleUrls: ['./welcomepage.css']
})
export class Welcomepage implements OnInit {
  isConfirmed = false;

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const paymentStatus = params['payment'];
      if (paymentStatus === 'success') {
        this.router.navigate(['/success'], { replaceUrl: true });
      } else if (paymentStatus === 'cancel') {
        this.router.navigate(['/cancel'], { replaceUrl: true });
      } else if (paymentStatus === 'failure') {
        this.router.navigate(['/failure'], { replaceUrl: true });
      }
    });
  }

  continue(): void {
    if (this.isConfirmed) {
      this.router.navigate(['/homepage']);
    }
  }

  downloadPdf(url: string, filename: string): void {
    // Create an invisible anchor element
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
