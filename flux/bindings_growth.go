package main

import (
	"errors"
	"flux/internal/growth"
	"flux/internal/telemetry"
	"fmt"
)

func (a *App) GetTiers() (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	return growth.MarshalTiers(a.growth.GetTiers())
}

func (a *App) GetTierCategories() []string {
	if a.growth == nil {
		return nil
	}
	return a.growth.GetTierCategories()
}

func (a *App) GetRecipes() (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	return growth.MarshalRecipes(a.growth.GetRecipes())
}

func (a *App) GetRecipe(id string) (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	r, ok := a.growth.GetRecipe(id)
	if !ok {
		return "", fmt.Errorf("recipe %q not found", id)
	}
	return growth.MarshalRecipe(r)
}

func (a *App) GetRecipeCategories() []string {
	if a.growth == nil {
		return nil
	}
	return a.growth.GetRecipeCategories()
}

func (a *App) GetCommunityConfig() (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	return growth.MarshalCommunityConfig(a.growth.GetCommunityConfig())
}

func (a *App) SetDiscordURL(url string) error {
	if a.growth == nil {
		return errors.New("growth not initialised")
	}
	a.growth.SetDiscordURL(url)
	a.track("community", "set_discord_url", nil)
	return nil
}

func (a *App) GetFeatureRequests() (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	return growth.MarshalFeatureRequests(a.growth.GetFeatureRequestsByVotes())
}

func (a *App) UpvoteFeatureRequest(id string) error {
	if a.growth == nil {
		return errors.New("growth not initialised")
	}
	err := a.growth.UpvoteFeatureRequest(id)
	if err == nil {
		a.track("roadmap", "upvote", map[string]interface{}{"id": id})
	}
	return err
}

func (a *App) GetBadges() (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	return growth.MarshalBadges(a.growth.GetBadges())
}

// track is an internal helper for telemetry (no-op if telemetry is nil/disabled)
func (a *App) track(category, action string, metadata map[string]interface{}) {
	if a.telemetry == nil || !a.telemetry.IsEnabled() {
		return
	}
	if a.growth == nil {
		return
	}
	a.telemetry.Track(telemetry.EventFeature, category+":"+action, metadata)
}

// --- AI --- (moved to bindings_ai.go)

// --- Dev Profile ---
