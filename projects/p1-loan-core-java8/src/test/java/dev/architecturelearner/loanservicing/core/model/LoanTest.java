package dev.architecturelearner.loanservicing.core.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.fail;

@DisplayName("Loan aggregate")
class LoanTest {

    @Nested
    @DisplayName("construction")
    class Construction {

        @Test
        @DisplayName("loan cannot be created with a missing mandatory field")
        void loan_cannot_be_created_with_a_missing_mandatory_field() {
            fail("LEARNER: pass null for each constructor argument in turn, assert NullPointerException naming the field (ADR-0003)");
        }

        @Test
        @DisplayName("loan cannot be created with a non-positive principal")
        void loan_cannot_be_created_with_a_non_positive_principal() {
            fail("LEARNER: build Loan with zero / negative principal, assert your chosen construction invariant rejects it");
        }

        @Test
        @DisplayName("loan cannot be created with an outstanding balance greater than principal")
        void loan_cannot_be_created_with_an_outstanding_balance_greater_than_principal() {
            fail("LEARNER: build Loan where outstandingBalance > principal, assert rejection (or document why it is allowed)");
        }

        @Test
        @DisplayName("loan cannot be created with a negative outstanding balance")
        void loan_cannot_be_created_with_a_negative_outstanding_balance() {
            fail("LEARNER: build Loan with negative outstandingBalance, assert construction invariant rejects it");
        }

        @Test
        @DisplayName("loan cannot be created when principal and balance use different currencies")
        void loan_cannot_be_created_when_principal_and_balance_use_different_currencies() {
            fail("LEARNER: build Loan with USD principal and EUR balance, assert your currency rule from ADR-0001 applies");
        }

        @Test
        @DisplayName("loan cannot be created in a status that is not a valid initial status")
        void loan_cannot_be_created_in_a_status_that_is_not_a_valid_initial_status() {
            fail("LEARNER: decide which LoanStatus values are legal at construction (ADR-0003), assert the others are rejected");
        }
    }

    @Nested
    @DisplayName("activate")
    class Activate {

        @Test
        @DisplayName("draft loan becomes active when activated")
        void draft_loan_becomes_active_when_activated() {
            fail("LEARNER: arrange a DRAFT Loan, call activate(date), assert returned Loan is ACTIVE");
        }

        @Test
        @DisplayName("activation returns a new instance and leaves the original unchanged")
        void activation_returns_a_new_instance_and_leaves_the_original_unchanged() {
            fail("LEARNER: activate a DRAFT Loan, assert original is still DRAFT and result is a different instance (immutability)");
        }

        @Test
        @DisplayName("activation is rejected when loan is not in draft")
        void activation_is_rejected_when_loan_is_not_in_draft() {
            fail("LEARNER: arrange ACTIVE / DELINQUENT / PAID_IN_FULL / CLOSED Loans, assert activate(...) is rejected");
        }

        @Test
        @DisplayName("activation is rejected when activation date is before start date")
        void activation_is_rejected_when_activation_date_is_before_start_date() {
            fail("LEARNER: activate with a date before startDate, assert the date semantics you chose reject it");
        }
    }

    @Nested
    @DisplayName("applyPayment")
    class ApplyPayment {

        @Test
        @DisplayName("payment reduces the outstanding balance by the payment amount")
        void payment_reduces_the_outstanding_balance_by_the_payment_amount() {
            fail("LEARNER: arrange ACTIVE Loan, apply a partial Payment, assert new outstandingBalance = old - payment");
        }

        @Test
        @DisplayName("payment that clears the balance marks the loan paid in full")
        void payment_that_clears_the_balance_marks_the_loan_paid_in_full() {
            fail("LEARNER: apply payment equal to outstandingBalance, assert status PAID_IN_FULL and zero balance");
        }

        @Test
        @DisplayName("payment larger than the outstanding balance is rejected")
        void payment_larger_than_the_outstanding_balance_is_rejected() {
            fail("LEARNER: apply overpayment, assert rejection (or document your overpayment policy)");
        }

        @Test
        @DisplayName("zero or negative payment is rejected")
        void zero_or_negative_payment_is_rejected() {
            fail("LEARNER: apply zero and negative Money, assert both are rejected");
        }

        @Test
        @DisplayName("payment in a different currency is rejected")
        void payment_in_a_different_currency_is_rejected() {
            fail("LEARNER: apply EUR payment to USD Loan, assert currency mismatch handling from ADR-0001");
        }

        @Test
        @DisplayName("payment is rejected when loan is already paid in full")
        void payment_is_rejected_when_loan_is_already_paid_in_full() {
            fail("LEARNER: arrange a PAID_IN_FULL Loan, attempt applyPayment, assert rejection");
        }

        @Test
        @DisplayName("payment is rejected when loan is draft or closed")
        void payment_is_rejected_when_loan_is_draft_or_closed() {
            fail("LEARNER: arrange DRAFT and CLOSED Loans, attempt applyPayment, assert rejection");
        }

        @Test
        @DisplayName("payment on a delinquent loan is accepted")
        void payment_on_a_delinquent_loan_is_accepted() {
            fail("LEARNER: arrange DELINQUENT Loan, apply payment, assert balance reduced and decide resulting status");
        }

        @Test
        @DisplayName("payment is rejected when received before the loan start date")
        void payment_is_rejected_when_received_before_the_loan_start_date() {
            fail("LEARNER: apply payment with receivedOn < startDate, assert date semantics reject it");
        }
    }

    @Nested
    @DisplayName("markDelinquent")
    class MarkDelinquent {

        @Test
        @DisplayName("active loan becomes delinquent")
        void active_loan_becomes_delinquent() {
            fail("LEARNER: arrange ACTIVE Loan, call markDelinquent(date), assert status DELINQUENT and balance unchanged");
        }

        @Test
        @DisplayName("marking delinquent is rejected when loan is not active")
        void marking_delinquent_is_rejected_when_loan_is_not_active() {
            fail("LEARNER: arrange DRAFT / PAID_IN_FULL / CLOSED Loans, assert markDelinquent is rejected (decide on DELINQUENT -> DELINQUENT)");
        }
    }

    @Nested
    @DisplayName("close")
    class Close {

        @Test
        @DisplayName("paid in full loan can be closed")
        void paid_in_full_loan_can_be_closed() {
            fail("LEARNER: arrange PAID_IN_FULL Loan, call close(date), assert status CLOSED");
        }

        @Test
        @DisplayName("closing is rejected while an outstanding balance remains")
        void closing_is_rejected_while_an_outstanding_balance_remains() {
            fail("LEARNER: arrange ACTIVE Loan with non-zero balance, call close, assert rejection");
        }

        @Test
        @DisplayName("closing an already closed loan is rejected")
        void closing_an_already_closed_loan_is_rejected() {
            fail("LEARNER: arrange CLOSED Loan, call close again, assert rejection (or document idempotency choice)");
        }
    }
}
