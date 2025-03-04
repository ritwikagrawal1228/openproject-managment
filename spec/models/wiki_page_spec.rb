#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) 2012-2022 the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#
# OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
# Copyright (C) 2006-2013 Jean-Philippe Lang
# Copyright (C) 2010-2013 the ChiliProject Team
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#
# See COPYRIGHT and LICENSE files for more details.
#++

require 'spec_helper'

describe WikiPage, type: :model do
  let(:project) { create(:project).reload } # a wiki is created for project, but the object doesn't know of it (FIXME?)
  let(:wiki) { project.wiki }
  let(:title) { wiki.wiki_menu_items.first.title }
  let(:wiki_page) { create(:wiki_page, wiki:, title:) }
  let(:new_wiki_page) { build(:wiki_page, wiki:, title:) }

  it_behaves_like 'acts_as_watchable included' do
    let(:model_instance) { create(:wiki_page) }
    let(:watch_permission) { :view_wiki_pages }
    let(:project) { model_instance.project }
  end

  it_behaves_like 'acts_as_attachable included' do
    let(:model_instance) { create(:wiki_page_with_content) }
    let(:project) { model_instance.project }
  end

  describe '#slug' do
    context 'when another project with same title exists' do
      let(:project2) { create(:project) }
      let(:wiki2) { project2.wiki }
      let!(:wiki_page1) { create(:wiki_page, wiki:, title: 'asdf') }
      let!(:wiki_page2) { create(:wiki_page, wiki: wiki2, title: 'asdf') }

      it 'scopes the slug correctly' do
        pages = described_class.where(title: 'asdf')
        expect(pages.count).to eq(2)
        expect(pages.first.slug).to eq('asdf')
        expect(pages.last.slug).to eq('asdf')
      end
    end

    context 'when only having a . for the title' do
      let(:wiki_page) { create(:wiki_page, wiki:, title: '.') }

      it 'creates a non empty slug' do
        expect(wiki_page.slug).to eq('dot')
      end
    end

    context 'when only having a ! for the title' do
      let(:wiki_page) { create(:wiki_page, wiki:, title: '!') }

      it 'creates a non empty slug' do
        expect(wiki_page.slug).to eq('bang')
      end
    end

    context 'when only having a { for the title' do
      let(:wiki_page) { create(:wiki_page, wiki:, title: '{') }

      it 'fails to create' do
        expect { wiki_page }
          .to raise_error(ActiveRecord::RecordInvalid)
      end
    end

    context 'with another default language', with_settings: { default_language: 'de' } do
      let(:wiki_page) { build(:wiki_page, wiki:, title: 'Übersicht') }

      it 'will still use english slug methods' do
        expect(wiki_page.save).to be true
        expect(wiki_page.slug).to eq 'ubersicht'
      end
    end

    context 'with another I18n.locale set', with_settings: { default_language: 'de' } do
      let(:wiki_page) { build(:wiki_page, wiki:, title: 'Übersicht') }

      it 'will still use english slug methods' do
        I18n.locale = :de
        expect(wiki_page.save).to be true
        expect(wiki_page.slug).to eq 'ubersicht'
      end
    end
  end

  describe '#nearest_main_item' do
    let(:child_page) { create(:wiki_page, parent: wiki_page, wiki:) }
    let!(:child_page_wiki_menu_item) do
      create(:wiki_menu_item, wiki:, name: child_page.slug, parent: wiki_page.menu_item)
    end
    let(:grand_child_page) { create(:wiki_page, parent: child_page, wiki:) }
    let!(:grand_child_page_wiki_menu_item) { create(:wiki_menu_item, wiki:, name: grand_child_page.slug) }

    it 'returns the menu item of the grand parent if the menu item of its parent is not a main item' do
      expect(grand_child_page.nearest_main_item).to eq(wiki_page.menu_item)
    end
  end

  describe '#destroy' do
    context 'for a page with content (which is always the case)' do
      let!(:wiki_content) { create(:wiki_content, page: wiki_page) }

      before do
        # to have the wiki_content properly hooked up
        wiki_page.reload
      end

      it 'destroys the wiki content as well' do
        expect { wiki_page.destroy }.to change(WikiContent, :count).from(1).to(0)
      end

      it 'destroys the wiki content\'s journals as well' do
        expect { wiki_page.destroy }.to change(Journal.for_wiki_content, :count).from(1).to(0)
      end
    end

    context 'when the only wiki page is destroyed' do
      before do
        wiki_page.destroy
      end

      it 'ensures there is still a wiki menu item' do
        expect(wiki.wiki_menu_items).to be_one
        expect(wiki.wiki_menu_items.first).to be_is_main_item
      end
    end

    context 'when one of two wiki pages is destroyed' do
      before do
        create(:wiki_page, wiki:)
        wiki_page.destroy
      end

      it 'ensures that there is still a wiki menu item named like the wiki start page' do
        expect(wiki.wiki_menu_items).to be_one
        expect(wiki.wiki_menu_items.first.name).to eq described_class.slug(wiki.start_page)
      end
    end

    context 'when destroying a parent' do
      let!(:child_wiki_page) do
        create(:wiki_page, parent_id: wiki_page.id, wiki:, project:)
      end

      before do
        wiki_page.destroy
      end

      it 'keeps the child but nils the parent_id' do
        expect(child_wiki_page.reload.parent_id)
          .to be_nil
      end
    end
  end

  describe '#title' do
    context 'when it is blank' do
      let(:title) { nil }

      it 'is invalid' do
        new_wiki_page.valid?

        expect(new_wiki_page.errors.symbols_for(:title))
          .to match_array [:blank]
      end
    end
  end

  describe '#protected?' do
    it 'is false by default' do
      expect(wiki_page.reload)
        .not_to be_protected
    end
  end

  describe '#project' do
    it 'is the same as the project on wiki' do
      expect(wiki_page.project).to eql(wiki.project)
    end
  end

  describe '#parent_title' do
    let(:child_wiki_page) do
      create(:wiki_page, parent_id: wiki_page.id, wiki:, project:)
    end

    it 'is empty for a page without a parent' do
      expect(wiki_page.parent_title)
        .to be_nil
    end

    it 'is the name of the parent page if set' do
      expect(child_wiki_page.parent_title)
        .to eq wiki_page.title
    end
  end

  describe '#parent_title=' do
    let(:other_wiki_page) do
      create(:wiki_page, wiki:, project:)
    end

    let(:other_wiki_page_child) do
      create(:wiki_page, parent: other_wiki_page, wiki:, project:)
    end

    context 'when setting it to the name of a wiki page' do
      it 'sets the parent to that wiki page' do
        wiki_page.parent_title = other_wiki_page.title
        wiki_page.save

        expect(wiki_page.reload.parent)
          .to eql(other_wiki_page)
      end
    end

    context 'when setting to an empty string' do
      let(:child_wiki_page) do
        create(:wiki_page, parent_id: wiki_page.id, wiki:, project:)
      end

      it 'unsets the parent' do
        child_wiki_page.parent_title = ''
        child_wiki_page.save

        expect(child_wiki_page.reload.parent)
          .to be_nil
      end
    end

    context 'when setting to a child' do
      let(:child_wiki_page) do
        create(:wiki_page, parent_id: wiki_page.id, wiki:, project:)
      end

      it 'causes an error' do
        wiki_page.parent_title = child_wiki_page.title

        expect(wiki_page.save)
          .to be false

        expect(wiki_page.errors[:parent_title])
          .to eq [I18n.t('activerecord.errors.messages.circular_dependency')]
      end
    end

    context 'when setting to a itself' do
      it 'causes an error' do
        wiki_page.parent_title = wiki_page.title

        expect(wiki_page.save)
          .to be false

        expect(wiki_page.errors[:parent_title])
          .to eq [I18n.t('activerecord.errors.messages.circular_dependency')]
      end
    end
  end

  describe '.visible' do
    let(:other_project) { create(:project).reload }
    let(:other_wiki) { project.wiki }
    let(:other_wiki_page) { create(:wiki_page, wiki:, title: wiki.wiki_menu_items.first.title) }
    let(:role) { create(:role, permissions: [:view_wiki_pages]) }
    let(:user) do
      create(:user,
             member_in_project: project,
             member_through_role: role)
    end

    it 'returns all pages for which the user has the \'view_wiki_pages\' permission' do
      expect(described_class.visible(user))
        .to match_array [wiki_page]
    end
  end
end
