package scheduler

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

type CronExpr struct {
	Minute     int // 0-59, -1 = any
	Hour       int // 0-23, -1 = any
	DayOfMonth int // 1-31, -1 = any
	Month      int // 1-12, -1 = any
	DayOfWeek  int // 0-6 (0=Sun), -1 = any
}

func ParseCron(expr string) (*CronExpr, error) {
	parts := strings.Fields(expr)
	if len(parts) != 5 {
		return nil, fmt.Errorf("cron expression must have 5 fields, got %d", len(parts))
	}
	c := &CronExpr{Minute: -1, Hour: -1, DayOfMonth: -1, Month: -1, DayOfWeek: -1}
	var err error
	if parts[0] != "*" {
		c.Minute, err = strconv.Atoi(parts[0])
		if err != nil || c.Minute < 0 || c.Minute > 59 {
			return nil, fmt.Errorf("invalid minute: %s", parts[0])
		}
	}
	if parts[1] != "*" {
		c.Hour, err = strconv.Atoi(parts[1])
		if err != nil || c.Hour < 0 || c.Hour > 23 {
			return nil, fmt.Errorf("invalid hour: %s", parts[1])
		}
	}
	if parts[2] != "*" {
		c.DayOfMonth, err = strconv.Atoi(parts[2])
		if err != nil || c.DayOfMonth < 1 || c.DayOfMonth > 31 {
			return nil, fmt.Errorf("invalid day of month: %s", parts[2])
		}
	}
	if parts[3] != "*" {
		c.Month, err = strconv.Atoi(parts[3])
		if err != nil || c.Month < 1 || c.Month > 12 {
			return nil, fmt.Errorf("invalid month: %s", parts[3])
		}
	}
	if parts[4] != "*" {
		c.DayOfWeek, err = strconv.Atoi(parts[4])
		if err != nil || c.DayOfWeek < 0 || c.DayOfWeek > 6 {
			return nil, fmt.Errorf("invalid day of week: %s", parts[4])
		}
	}
	return c, nil
}

func (c *CronExpr) Matches(t time.Time) bool {
	if c.Minute >= 0 && t.Minute() != c.Minute {
		return false
	}
	if c.Hour >= 0 && t.Hour() != c.Hour {
		return false
	}
	if c.DayOfMonth >= 0 && t.Day() != c.DayOfMonth {
		return false
	}
	if c.Month >= 0 && int(t.Month()) != c.Month {
		return false
	}
	if c.DayOfWeek >= 0 && int(t.Weekday()) != c.DayOfWeek {
		return false
	}
	return true
}

func (c *CronExpr) NextAfter(after time.Time) time.Time {
	for i := 0; i < 525600; i++ { // max 1 year ahead
		t := after.Add(time.Duration(i) * time.Minute)
		if c.Matches(t) && t.After(after) {
			return t
		}
	}
	return time.Time{}
}
