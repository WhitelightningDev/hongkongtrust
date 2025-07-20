import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

declare var bootstrap: any; // for Bootstrap modal support


@Component({
  selector: 'app-payment-method-modal',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './payment-method-modal.html',
  styleUrls: ['./payment-method-modal.css']
})
export class PaymentMethodModalComponent {
  selectedMethod: string = 'card';
  @Output() confirm = new EventEmitter<string>();

  onConfirm() {
    if (this.selectedMethod === 'crypto') return;
    this.confirm.emit(this.selectedMethod);
    const modalEl = document.getElementById('paymentMethodModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    modalInstance?.hide();
  }
}
