/**
 * @file Test collections/modules/Notes
 */
import test from 'tape';
import sinon from 'sinon';
import Radio from 'backbone.radio';

import Module from '../../../../app/scripts/collections/modules/Notes';
import ModuleOrig from '../../../../app/scripts/collections/modules/Module';
import Notes from '../../../../app/scripts/collections/Notes';

let sand;
test('Notes: before()', t => {
    sand = sinon.sandbox.create();
    t.end();
});

test('Notes: Collection', t => {
    t.equal(Module.prototype.Collection, Notes,
        'uses notes collection');
    t.end();
});

test('Notes: constructor()', t => {
    const reply = sand.stub(Module.prototype.channel, 'reply');
    const mod   = new Module();

    const replies = {restore: mod.restore, changeNotebookId: mod.changeNotebookId};
    t.equal(reply.calledWith(replies), true,
        'replies to restore and changeNotebookId request');

    sand.restore();
    t.end();
});

test('Notes: saveModel()', t => {
    const mod   = new Module();
    const model = new mod.Model(
        {id: 'test-save1', tags: ['1', '2']},
        {profileId: 'test'}
    );
    const save  = sand.stub(ModuleOrig.prototype, 'saveModel');
    const reply = sand.stub().returns(Promise.resolve());
    Radio.replyOnce('collections/Tags', 'addTags', reply);

    mod.saveModel({model});
    t.equal(save.calledWith({model}), true, 'saves the model');
    t.equal(reply.notCalled, true, 'does not create tags if saveTags is undefined');

    return mod.saveModel({model, saveTags: true})
    .then(() => {
        t.equal(reply.calledWith({tags: model.attributes.tags, profileId: 'test'}), true,
            'creates new tags if saveTags is equal to true');
        t.equal(save.calledWith({model}), true, 'saves the model');

        mod.channel.stopReplying();
        sand.restore();
        t.end();
    });
});

test('Notes: remove()', t => {
    const mod    = new Module();
    const model  = new mod.Model({id: '1', trash: 1});
    const remove = sand.stub(ModuleOrig.prototype, 'remove');
    const save   = sand.stub(mod, 'saveModel').returns(Promise.resolve());
    sand.stub(mod.channel, 'trigger');

    mod.remove({model})
    .then(() => {
        t.equal(remove.calledWith({model}), true,
            'removes the model if it is already in trash');

        model.set({trash: 0});
        return mod.remove({model});
    })
    .then(() => {
        t.equal(save.calledWith({model, data: {trash: 1}}), true,
            'changes a models trash status');
        t.equal(mod.channel.trigger.calledWith('destroy:model', {model}), true,
            'triggers "destroy:model" event');

        mod.channel.stopReplying();
        sand.restore();
        t.end();
    });
});

test('Notes: findOrFetch()', t => {
    const mod  = new Module();
    const find = sand.stub(mod, 'findModel').returns(Promise.resolve());

    mod.findOrFetch({model: {id: '1'}})
    .then(model => {
        t.deepEqual(model, {id: '1'}, 'returns the model');
        t.equal(find.notCalled, true, 'does not fetch if model exists in the options');

        return mod.findOrFetch({id: '1'});
    })
    .then(() => {
        t.equal(find.calledWith({id: '1'}), true, 'fetches the model from database');

        mod.channel.stopReplying();
        sand.restore();
        t.end();
    });
});

test('Notes: restore()', t => {
    const mod   = new Module();
    const model = new mod.Model({id: '1', trash: 2});
    const save  = sand.stub(mod, 'saveModel').returns(Promise.resolve());
    sand.stub(mod.channel, 'trigger');

    mod.restore({model})
    .then(() => {
        t.equal(save.calledWith({model, data: {trash: 0}}), true,
            'changes trash status of the model and saves it');
        t.equal(mod.channel.trigger.calledWith('restore:model', {model}), true,
            'triggers "restore:model" event');

        mod.channel.stopReplying();
        sand.restore();
        t.end();
    });
});

test('Notes: changeNotebookId()', t => {
    const mod        = new Module();
    const model      = new mod.Model({id: '1'}, {profileId: 'test'});
    const collection = new mod.Collection([{id: '1'}, {id: '2'}]);
    sand.stub(mod, 'find').returns(Promise.resolve(collection));
    sand.stub(mod, 'save');

    mod.changeNotebookId({model})
    .then(() => {
        const opt = {profileId: 'test', conditions: {notebookId: '1'}};
        t.equal(mod.find.calledWith(opt), true,
            'fetches notes associated with the notebook');
        t.equal(mod.save.calledWith({collection, data: {notebookId: 0}}), true,
            'changes notebookId to 0');

        return mod.changeNotebookId({model, removeNotes: true});
    })
    .then(() => {
        t.equal(mod.save.calledWith({collection, data: {notebookId: 0, trash: 1}}), true,
            'changes notebookId to 0 and trash status to 1');

        mod.channel.stopReplying();
        sand.restore();
        t.end();
    });
});

test('Notes: find()', t => {
    const mod        = new Module();
    const collection = new mod.Collection([{id: '1'}, {id: '2'}]);
    const find       = sand.stub(ModuleOrig.prototype, 'find');
    find.returns(Promise.resolve(collection));
    sand.spy(collection, 'filterList');
    Radio.replyOnce('collections/Configs', 'findConfig', () => 'id');

    const opt = {profileId: 'test', filter: 'yes'};
    return mod.find(opt)
    .then(collection => {
        t.equal(find.calledWithMatch({profileId: 'test', sortField: 'id'}), true,
            'uses sortField config when fetching models');
        t.equal(collection.filterList.calledWith('yes'), true,
            'filters the collection');

        mod.channel.stopReplying();
        sand.restore();
        t.end();
    });
});

test('Notes: findModel()', t => {
    const mod   = new Module();
    const model = new mod.Model({id: '1'});
    const find  = sand.stub(ModuleOrig.prototype, 'findModel')
        .returns(Promise.resolve(model));

    sand.stub(mod, 'findAttachments');

    return mod.findModel({id: '1', profileId: 'test'})
    .then(() => {
        t.equal(find.calledWith({id: '1', profileId: 'test'}), true,
            'fetches the model');
        t.equal(mod.findAttachments.notCalled, true,
            'does not fetch attachments if findAttachments is false');

        return mod.findModel({id: '1', profileId: 'test', findAttachments: true});
    })
    .then(() => {
        t.equal(mod.findAttachments.calledWith({model}), true,
            'fetches attachments too if findAttachments is equal to true');

        mod.channel.stopReplying();
        sand.restore();
        t.end();
    });
});

test('Notes: findAttachments()', t => {
    const mod   = new Module();
    const model = new mod.Model(
        {id: '1', files: ['1', '2'], notebookId: '12'},
        {profileId: 'test'}
    );
    const replyNotebook = sand.stub().returns('notebook');
    const replyFiles    = sand.stub().returns('files');
    Radio.replyOnce('collections/Notebooks', 'findModel', replyNotebook);
    Radio.replyOnce('collections/Files', 'findFiles', replyFiles);

    mod.findAttachments({model})
    .then(() => {
        t.equal(replyNotebook.calledWith({profileId: 'test', id: '12'}), true,
            'fetches a notebook');
        t.equal(replyFiles.calledWith({profileId: 'test', ids: ['1', '2']}), true,
            'fetches files');
        t.equal(model.notebook, 'notebook', 'creates notebook property');
        t.equal(model.fileModels, 'files', 'creates fileModels property');

        sand.restore();
        mod.channel.stopReplying();
        t.end();
    });
});
