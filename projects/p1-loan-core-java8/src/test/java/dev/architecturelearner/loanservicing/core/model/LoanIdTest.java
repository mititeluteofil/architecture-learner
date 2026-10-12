package dev.architecturelearner.loanservicing.core.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.fail;

@DisplayName("LoanId value object")
class LoanIdTest {

    @Test
    @DisplayName("loan id cannot be created from a null uuid")
    void loan_id_cannot_be_created_from_a_null_uuid() {
        fail("LEARNER: new LoanId(null), assert NullPointerException");
    }

    @Test
    @DisplayName("loan id rejects uuid versions outside the accepted policy")
    void loan_id_rejects_uuid_versions_outside_the_accepted_policy() {
        fail("LEARNER: decide accepted UUID version(s) in ADR-0002, then assert e.g. a v4 / nil UUID is accepted or rejected");
    }

    @Test
    @DisplayName("random produces distinct ids")
    void random_produces_distinct_ids() {
        fail("LEARNER: generate several LoanId.random() values, assert they are all distinct");
    }

    @Test
    @DisplayName("random produces time ordered version 7 uuids")
    void random_produces_time_ordered_version_7_uuids() {
        fail("LEARNER: assert LoanId.random().getValue().version() matches the generator choice and successive ids sort by time");
    }

    @Test
    @DisplayName("loan ids wrapping the same uuid are equal with the same hash code")
    void loan_ids_wrapping_the_same_uuid_are_equal_with_the_same_hash_code() {
        fail("LEARNER: wrap one UUID twice, assert equals and hashCode contract");
    }

    @Test
    @DisplayName("loan ids wrapping different uuids are not equal")
    void loan_ids_wrapping_different_uuids_are_not_equal() {
        fail("LEARNER: wrap two different UUIDs, assert not equal");
    }

    @Test
    @DisplayName("toString exposes the canonical uuid string")
    void toString_exposes_the_canonical_uuid_string() {
        fail("LEARNER: assert toString equals the wrapped UUID's toString");
    }
}
