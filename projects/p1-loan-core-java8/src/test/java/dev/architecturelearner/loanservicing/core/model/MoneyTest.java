package dev.architecturelearner.loanservicing.core.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.fail;

@DisplayName("Money value object")
class MoneyTest {

    @Test
    @DisplayName("money cannot be created without an amount or currency")
    void money_cannot_be_created_without_an_amount_or_currency() {
        fail("LEARNER: pass null amount and null currency, assert NullPointerException for each");
    }

    @Test
    @DisplayName("amount is normalised to two decimal places using half even rounding")
    void amount_is_normalised_to_two_decimal_places_using_half_even_rounding() {
        fail("LEARNER: create Money with 10.125 and 10.135, assert scale 2 and banker's rounding results (ADR-0004)");
    }

    @Test
    @DisplayName("negative amount is handled according to the chosen invariant")
    void negative_amount_is_handled_according_to_the_chosen_invariant() {
        fail("LEARNER: create Money with a negative amount, assert rejection or acceptance per your constructor invariant");
    }

    @Test
    @DisplayName("adding money of the same currency sums the amounts")
    void adding_money_of_the_same_currency_sums_the_amounts() {
        fail("LEARNER: add two USD Money values, assert amount and currency of the result");
    }

    @Test
    @DisplayName("subtracting money of the same currency yields the difference")
    void subtracting_money_of_the_same_currency_yields_the_difference() {
        fail("LEARNER: subtract two USD Money values, assert amount and currency of the result");
    }

    @Test
    @DisplayName("subtracting below zero follows the chosen policy")
    void subtracting_below_zero_follows_the_chosen_policy() {
        fail("LEARNER: subtract larger from smaller, assert negative result or rejection per your decision");
    }

    @Test
    @DisplayName("arithmetic across different currencies is rejected")
    void arithmetic_across_different_currencies_is_rejected() {
        fail("LEARNER: add / subtract USD and EUR, assert the mismatch handling chosen in ADR-0001");
    }

    @Test
    @DisplayName("comparing money across different currencies is rejected")
    void comparing_money_across_different_currencies_is_rejected() {
        fail("LEARNER: compareTo between USD and EUR, assert mismatch handling");
    }

    @Test
    @DisplayName("compareTo orders money by amount within one currency")
    void compareTo_orders_money_by_amount_within_one_currency() {
        fail("LEARNER: compare smaller, equal and larger USD values, assert sign of compareTo");
    }

    @Test
    @DisplayName("isZero and isNegative reflect the sign of the amount")
    void isZero_and_isNegative_reflect_the_sign_of_the_amount() {
        fail("LEARNER: check zero, positive and negative Money against isZero / isNegative");
    }

    @Test
    @DisplayName("money with equal amount and currency are equal regardless of input scale")
    void money_with_equal_amount_and_currency_are_equal_regardless_of_input_scale() {
        fail("LEARNER: compare new Money(10, USD) and new Money(10.00, USD), assert equals and same hashCode");
    }

    @Test
    @DisplayName("money with same amount but different currency are not equal")
    void money_with_same_amount_but_different_currency_are_not_equal() {
        fail("LEARNER: compare 10 USD and 10 EUR, assert not equal");
    }

    @Test
    @DisplayName("toString shows currency code and amount")
    void toString_shows_currency_code_and_amount() {
        fail("LEARNER: assert the string format, e.g. \"USD 10.00\"");
    }
}
